import assert from 'node:assert/strict';
import * as nodeFs from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import * as cpexcel from 'xlsx/dist/cpexcel.full.mjs';
import { registerFolder, registerSelectedFiles } from '../../src/main/services/file-selection/file-registry';
import { parseSplitDocumentMetadata } from '../../src/main/services/excel/split-metadata';
import { runMergeJob } from '../../src/main/services/excel/merge-job';
import { parseMergeFolder } from '../../src/main/services/excel/merge-folder';
import { runSplitJob } from '../../src/main/services/excel/split-job';
import { exportSpeechTranscripts, probeSpeechAudioDurations, runSpeechTranscriptionJob } from '../../src/main/services/speech/speech-job';
import { ensureSpeechModels, getSpeechModelStatus, updateSpeechModelSettings } from '../../src/main/services/speech/speech-models';
import type { JobEvent } from '../../src/shared/types/jobs';
import type { SelectedFile } from '../../src/shared/types/files';
import type { SpeechEvent } from '../../src/shared/types/speech';

XLSX.set_fs(nodeFs);
XLSX.set_cptable(cpexcel);

const WORKSHEET_NAME = 'Data';

type WorkbookRows = string[][];

const getOnlySelectedFile = (files: SelectedFile[]): SelectedFile => {
  const selectedFile = files[0];
  if (!selectedFile) {
    throw new Error('Expected one registered file');
  }

  return selectedFile;
};

const createSourceWorkbook = async (filePath: string): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(WORKSHEET_NAME);
  worksheet.addRow(['Department', 'Name', 'Amount']);
  worksheet.addRow(['Sales', 'Alice', 10]);
  worksheet.addRow(['HR', 'Bob', 20]);
  worksheet.addRow(['Sales', 'Cara', 30]);

  await workbook.xlsx.writeFile(filePath);
};


const createNullableFormulaWorkbook = async (filePath: string): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(WORKSHEET_NAME);
  worksheet.getCell('A1').value = 'Header';
  worksheet.getCell('A2').value = { formula: '1+1', result: null } as unknown as ExcelJS.CellFormulaValue;
  worksheet.getCell('B2').value = null;

  await workbook.xlsx.writeFile(filePath);
};

const createLegacyWorkbook = (filePath: string): void => {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Department', 'Name'],
    ['Sales', 'Alice'],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, WORKSHEET_NAME);
  XLSX.writeFile(workbook, filePath, { bookType: 'biff8' });
};

const readWorkbookRows = async (filePath: string): Promise<WorkbookRows> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Expected workbook to contain a worksheet');
  }

  const rows: WorkbookRows = [];
  worksheet.eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      values.push(String(cell.value ?? ''));
    });
    rows.push(values);
  });

  return rows;
};

const getDataNames = (rows: WorkbookRows): string[] => {
  return rows
    .slice(1)
    .map((row) => row[1])
    .filter((name): name is string => Boolean(name));
};

const hasCompletedProgress = (events: JobEvent[], expectedTab: 'split' | 'merge'): boolean => {
  return events.some((event) => {
    return event.type === 'progress'
      && event.tab === expectedTab
      && event.progress.stage === 'completed';
  });
};

test('splits a workbook by department and merges the generated workbooks', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'office-tools-functional-'));

  try {
    process.env.OFFICE_TOOLS_TEST_USER_DATA = path.join(workspace, 'user-data');
    const sourcePath = path.join(workspace, 'source.xlsx');
    const splitOutputDirectory = path.join(workspace, 'split-output');
    const mergeOutputDirectory = path.join(workspace, 'merge-output');
    await createSourceWorkbook(sourcePath);

    const sourceFile = getOnlySelectedFile(await registerSelectedFiles([sourcePath]));
    const splitEvents: JobEvent[] = [];
    const splitResult = await runSplitJob(
      {
        outputDirectory: splitOutputDirectory,
        files: [
          {
            fieldRow: 1,
            sheetName: WORKSHEET_NAME,
            sourceId: sourceFile.sourceId,
            splitColumn: 1,
          },
        ],
      },
      (event) => splitEvents.push(event),
    );

    assert.equal(splitResult.files[0]?.status, 'completed');
    assert.equal(splitResult.files[0]?.outputCount, 2);
    assert.ok(hasCompletedProgress(splitEvents, 'split'));

    const splitZip = await JSZip.loadAsync(await readFile(splitResult.outputPath));
    const splitEntries = Object.values(splitZip.files).filter((entry) => {
      return !entry.dir && entry.name.endsWith('.xlsx');
    });
    assert.equal(splitEntries.length, 2);

    const extractedPaths: string[] = [];
    const groupedNames = new Map<string, string[]>();
    for (const entry of splitEntries) {
      const buffer = await entry.async('nodebuffer');
      const outputPath = path.join(workspace, path.basename(entry.name));
      await writeFile(outputPath, buffer);
      extractedPaths.push(outputPath);

      const rows = await readWorkbookRows(outputPath);
      const department = rows[1]?.[0];
      if (!department) {
        throw new Error(`Expected ${entry.name} to contain a department row`);
      }
      groupedNames.set(department, getDataNames(rows));
    }

    assert.deepEqual(groupedNames.get('Sales'), ['Alice', 'Cara']);
    assert.deepEqual(groupedNames.get('HR'), ['Bob']);

    const mergeFiles = await registerSelectedFiles(extractedPaths);
    const mergeEvents: JobEvent[] = [];
    const mergeResult = await runMergeJob(
      {
        fieldRow: 1,
        files: mergeFiles.map((file) => ({
          sheetName: WORKSHEET_NAME,
          sourceId: file.sourceId,
        })),
        mode: 'single-sheet',
        outputDirectory: mergeOutputDirectory,
      },
      (event) => mergeEvents.push(event),
    );

    assert.equal(mergeResult.files.every((file) => file.status === 'completed'), true);
    assert.ok(hasCompletedProgress(mergeEvents, 'merge'));

    const mergedRows = await readWorkbookRows(mergeResult.outputPath);
    assert.deepEqual(getDataNames(mergedRows).sort(), ['Alice', 'Bob', 'Cara']);
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});


test('parses metadata for null xlsx cells and legacy workbook files', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'office-tools-metadata-'));

  try {
    const xlsxPath = path.join(workspace, 'nullable.xlsx');
    const xlsPath = path.join(workspace, 'legacy.xls');
    const etPath = path.join(workspace, 'legacy.et');
    const invalidXlsPath = path.join(workspace, 'invalid.xls');
    await createNullableFormulaWorkbook(xlsxPath);
    createLegacyWorkbook(xlsPath);
    createLegacyWorkbook(etPath);
    await writeFile(invalidXlsPath, 'not a workbook');

    const selectedFiles = await registerSelectedFiles([xlsxPath, xlsPath, etPath, invalidXlsPath]);
    const metadata = await parseSplitDocumentMetadata([
      ...selectedFiles.map((file) => file.sourceId),
      'missing-source-id',
    ]);

    assert.equal(metadata.failures.length, 2);
    assert.equal(metadata.failures.find((failure) => failure.fileName === 'invalid.xls')?.error, 'XLS 文件格式无效，请另存为 .xlsx 后重试');
    assert.equal(metadata.failures.find((failure) => failure.sourceId === 'missing-source-id')?.error, '找不到已选择文件，请重新选择文件');
    assert.equal(metadata.workbooks.length, 3);
    assert.deepEqual(
      metadata.workbooks.map((workbook) => workbook.fileName).sort(),
      ['legacy.et', 'legacy.xls', 'nullable.xlsx'],
    );
    assert.equal(metadata.workbooks.find((workbook) => workbook.fileName === 'nullable.xlsx')?.sheets[0]?.previewRows[1]?.[0], '');
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
 });


test('scans merge folders recursively and reports invalid workbook failures', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'office-tools-merge-folder-'));

  try {
    const nestedDirectory = path.join(workspace, 'nested');
    await mkdir(nestedDirectory, { recursive: true });
    const validWorkbookPath = path.join(nestedDirectory, 'valid.xlsx');
    const invalidWorkbookPath = path.join(workspace, 'invalid.xls');
    const ignoredTextPath = path.join(workspace, 'ignored.txt');
    await createSourceWorkbook(validWorkbookPath);
    await writeFile(invalidWorkbookPath, 'not a workbook');
    await writeFile(ignoredTextPath, 'not excel');

    const selectedFolder = await registerFolder(workspace);
    const result = await parseMergeFolder(selectedFolder.sourceId);

    assert.deepEqual(result.excludedFiles, []);
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0]?.name, 'valid.xlsx');
    assert.deepEqual(result.workbooks.map((workbook) => workbook.fileName), ['valid.xlsx']);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0]?.fileName, 'invalid.xls');
    assert.equal(result.failures[0]?.error, 'XLS 文件格式无效，请另存为 .xlsx 后重试');
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});


test('downloads and extracts speech model packages from configured address', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'office-tools-models-'));
  const originalUserData = process.env.OFFICE_TOOLS_TEST_USER_DATA;

  try {
    process.env.OFFICE_TOOLS_TEST_USER_DATA = path.join(workspace, 'user-data');
    const remoteDirectory = path.join(workspace, 'remote');
    await mkdir(remoteDirectory, { recursive: true });

    const createModelPackage = async (packagePath: string, entryPath: string): Promise<void> => {
      const zip = new JSZip();
      zip.file(entryPath, 'fake onnx content');
      await writeFile(packagePath, await zip.generateAsync({ type: 'nodebuffer' }));
    };

    await createModelPackage(path.join(remoteDirectory, 'funasr-asr-model.zip'), 'asr-model/model_quant.onnx');
    await createModelPackage(path.join(remoteDirectory, 'funasr-punc-model.zip'), 'punc-model/model.onnx');

    await updateSpeechModelSettings(pathToFileURL(remoteDirectory).toString());
    const beforeStatus = await getSpeechModelStatus();
    assert.equal(beforeStatus.ready, false);

    const progressPackages: string[] = [];
    const afterStatus = await ensureSpeechModels((progress) => {
      if (progress.phase === 'completed') {
        progressPackages.push(progress.packageName);
      }
    });

    assert.equal(afterStatus.ready, true);
    assert.deepEqual(progressPackages.sort(), ['funasr-asr-model.zip', 'funasr-punc-model.zip']);
  } finally {
    if (originalUserData === undefined) {
      delete process.env.OFFICE_TOOLS_TEST_USER_DATA;
    } else {
      process.env.OFFICE_TOOLS_TEST_USER_DATA = originalUserData;
    }
    await rm(workspace, { force: true, recursive: true });
  }
});


test('transcribes speech files with fake helper and continues after unsupported files', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'office-tools-speech-'));
  const originalFakeMode = process.env.OFFICE_TOOLS_SPEECH_FAKE;
  const originalFakeDuration = process.env.OFFICE_TOOLS_SPEECH_FAKE_DURATION_SECONDS;

  try {
    process.env.OFFICE_TOOLS_SPEECH_FAKE = '1';
    const firstAudioPath = path.join(workspace, 'meeting.wav');
    const unsupportedPath = path.join(workspace, 'notes.txt');
    const secondAudioPath = path.join(workspace, 'interview.flac');
    await writeFile(firstAudioPath, 'fake wav content');
    await writeFile(unsupportedPath, 'not audio');
    await writeFile(secondAudioPath, 'fake flac content');

    const selectedFiles = await registerSelectedFiles([firstAudioPath, unsupportedPath, secondAudioPath]);
    process.env.OFFICE_TOOLS_SPEECH_FAKE_DURATION_SECONDS = String((4 * 60 * 60) + 1);
    const durationProbe = await probeSpeechAudioDurations({
      sourceIds: [selectedFiles[0]?.sourceId ?? ''],
    });
    assert.equal(durationProbe.items[0]?.isLongDuration, true);
    assert.equal(durationProbe.items[0]?.durationSeconds, (4 * 60 * 60) + 1);
    delete process.env.OFFICE_TOOLS_SPEECH_FAKE_DURATION_SECONDS;

    const events: SpeechEvent[] = [];
    const result = await runSpeechTranscriptionJob(
      {
        sourceIds: selectedFiles.map((file) => file.sourceId),
      },
      (event) => events.push(event),
    );

    assert.equal(result.summary.totalFiles, 3);
    assert.equal(result.summary.completedFiles, 2);
    assert.equal(result.summary.failedFiles, 1);
    assert.equal(result.items[0]?.status, 'completed');
    assert.match(result.items[0]?.transcript ?? '', /meeting\.wav/);
    assert.equal(result.items[1]?.status, 'failed');
    assert.match(result.items[1]?.error ?? '', /TXT 类型不支持/);
    assert.equal(result.items[2]?.status, 'completed');
    assert.match(result.items[2]?.transcript ?? '', /interview\.flac/);
    assert.ok(events.some((event) => event.type === 'progress' && event.progress.message === '批量转写完成'));

    const outputDirectory = path.join(workspace, 'transcripts');
    await mkdir(outputDirectory, { recursive: true });
    const exportResult = await exportSpeechTranscripts({
      outputDirectory,
      items: result.items
        .filter((item) => item.status === 'completed')
        .map((item) => ({
          name: item.name,
          sourceId: item.sourceId,
          transcript: item.transcript,
        })),
    });

    assert.equal(exportResult.files.length, 2);
    assert.match(await readFile(exportResult.files[0]?.path ?? '', 'utf8'), /meeting\.wav/);

    const duplicateExportResult = await exportSpeechTranscripts({
      outputDirectory,
      items: [
        {
          name: 'meeting.wav',
          sourceId: 'duplicate-one',
          transcript: 'first duplicate transcript',
        },
        {
          name: 'meeting.wav',
          sourceId: 'duplicate-two',
          transcript: 'second duplicate transcript',
        },
      ],
    });

    assert.deepEqual(
      duplicateExportResult.files.map((file) => path.basename(file.path)),
      ['meeting-2.txt', 'meeting-3.txt'],
    );
    assert.match(await readFile(duplicateExportResult.files[1]?.path ?? '', 'utf8'), /second duplicate/);
  } finally {
    if (originalFakeMode === undefined) {
      delete process.env.OFFICE_TOOLS_SPEECH_FAKE;
    } else {
      process.env.OFFICE_TOOLS_SPEECH_FAKE = originalFakeMode;
    }
    if (originalFakeDuration === undefined) {
      delete process.env.OFFICE_TOOLS_SPEECH_FAKE_DURATION_SECONDS;
    } else {
      process.env.OFFICE_TOOLS_SPEECH_FAKE_DURATION_SECONDS = originalFakeDuration;
    }
    await rm(workspace, { force: true, recursive: true });
  }
});
