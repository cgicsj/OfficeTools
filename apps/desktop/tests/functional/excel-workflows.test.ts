import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { registerSelectedFiles } from '../../src/main/services/file-selection/file-registry';
import { runMergeJob } from '../../src/main/services/excel/merge-job';
import { runSplitJob } from '../../src/main/services/excel/split-job';
import type { JobEvent } from '../../src/shared/types/jobs';
import type { SelectedFile } from '../../src/shared/types/files';

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
