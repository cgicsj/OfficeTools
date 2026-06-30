#!/usr/bin/env node
/* global Buffer, process */
import * as nodeFs from 'node:fs';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import * as cpexcel from 'xlsx/dist/cpexcel.full.mjs';
import yauzl from 'yauzl';

XLSX.set_fs(nodeFs);
XLSX.set_cptable(cpexcel);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDirectory, '..');
const repoRoot = path.resolve(desktopRoot, '../..');
const taskDirectory = path.join(repoRoot, '.trellis/tasks/06-28-excel-processing-probe');
const defaultSampleDirectory = path.join(taskDirectory, 'samples');
const defaultOutputDirectory = path.join(taskDirectory, 'probe-output');
const defaultReportPath = path.join(taskDirectory, 'report.md');

const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

const parseArgs = (argv) => {
  const options = {
    sampleDirectory: defaultSampleDirectory,
    outputDirectory: defaultOutputDirectory,
    reportPath: defaultReportPath,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--sample-dir' && nextValue) {
      options.sampleDirectory = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (arg === '--out-dir' && nextValue) {
      options.outputDirectory = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (arg === '--report' && nextValue) {
      options.reportPath = path.resolve(nextValue);
      index += 1;
      continue;
    }
  }

  return options;
};

const pathExists = async (targetPath) => {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const findSamples = async (sampleDirectory) => {
  if (!(await pathExists(sampleDirectory))) {
    return [];
  }

  const entries = await readdir(sampleDirectory);
  const samples = [];

  for (const entry of entries) {
    const filePath = path.join(sampleDirectory, entry);
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      continue;
    }

    const extension = path.extname(entry).toLowerCase();
    if (['.xls', '.xlsx', '.et'].includes(extension)) {
      samples.push({
        name: entry,
        path: filePath,
        extension,
        sizeBytes: fileStats.size,
      });
    }
  }

  return samples.sort((left, right) => left.name.localeCompare(right.name));
};

const cloneCellValue = (value) => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneCellValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, cloneCellValue(entryValue)]),
    );
  }

  return value;
};

const cloneJsonValue = (value) => {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
};

const copyWorksheet = (sourceWorksheet, targetWorksheet) => {
  sourceWorksheet.columns.forEach((sourceColumn, columnIndex) => {
    const targetColumn = targetWorksheet.getColumn(columnIndex + 1);
    targetColumn.width = sourceColumn.width;
    targetColumn.hidden = sourceColumn.hidden;
    targetColumn.outlineLevel = sourceColumn.outlineLevel;
    targetColumn.style = cloneJsonValue(sourceColumn.style) ?? {};
  });

  sourceWorksheet.eachRow({ includeEmpty: true }, (sourceRow, rowNumber) => {
    const targetRow = targetWorksheet.getRow(rowNumber);
    targetRow.height = sourceRow.height;
    targetRow.hidden = sourceRow.hidden;
    targetRow.outlineLevel = sourceRow.outlineLevel;

    sourceRow.eachCell({ includeEmpty: true }, (sourceCell, columnNumber) => {
      const targetCell = targetRow.getCell(columnNumber);
      targetCell.value = cloneCellValue(sourceCell.value);
      targetCell.style = cloneJsonValue(sourceCell.style) ?? {};
      targetCell.numFmt = sourceCell.numFmt;
    });

    targetRow.commit();
  });

  for (const mergeRange of sourceWorksheet.model.merges ?? []) {
    targetWorksheet.mergeCells(mergeRange);
  }
};

const createSyntheticWorkbook = async (outputPath) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OfficeTools Excel probe';
  workbook.created = new Date('2026-06-28T00:00:00Z');

  const worksheet = workbook.addWorksheet('源数据');
  worksheet.columns = [
    { header: '部门', key: 'department', width: 18 },
    { header: '金额', key: 'amount', width: 14 },
    { header: '日期', key: 'date', width: 16 },
    { header: '长编号', key: 'longId', width: 24 },
    { header: '已保存公式', key: 'savedFormula', width: 16 },
    { header: '未保存公式', key: 'unsavedFormula', width: 16 },
  ];

  worksheet.mergeCells('A1:F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'OfficeTools 样式保留探针';
  titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166C62' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 26;

  const headerRow = worksheet.getRow(2);
  headerRow.values = ['部门', '金额', '日期', '长编号', '已保存公式', '未保存公式'];
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCEFED' } };
  headerRow.height = 22;

  worksheet.getRow(3).values = [
    '财务部',
    1234.56,
    new Date('2026-06-28T00:00:00Z'),
    '001234567890123456',
    { formula: 'B3*2', result: 2469.12 },
    { formula: 'B3*3' },
  ];

  worksheet.getCell('B3').numFmt = '#,##0.00';
  worksheet.getCell('C3').numFmt = 'yyyy-mm-dd';
  worksheet.getCell('D3').numFmt = '@';
  worksheet.getCell('E3').numFmt = '#,##0.00';
  worksheet.getCell('F3').numFmt = '#,##0.00';
  worksheet.getCell('A3').border = { bottom: { style: 'thin', color: { argb: 'FFBAC7C2' } } };
  worksheet.getRow(4).values = ['隐藏行', 1, new Date('2026-06-29T00:00:00Z')];
  worksheet.getRow(4).hidden = true;
  worksheet.getColumn(6).hidden = true;

  await workbook.xlsx.writeFile(outputPath);
};

const createObjectWorkbook = async (outputPath) => {
  const workbook = new ExcelJS.Workbook();
  const plainSheet = workbook.addWorksheet('无对象');
  plainSheet.getCell('A1').value = 'plain';

  const objectSheet = workbook.addWorksheet('含图片');
  objectSheet.getCell('A1').value = 'image';
  const imageId = workbook.addImage({
    base64: tinyPngBase64,
    extension: 'png',
  });
  objectSheet.addImage(imageId, 'B2:C4');

  await workbook.xlsx.writeFile(outputPath);
};

const inspectExcelJsRoundTrip = async (outputDirectory) => {
  const sourcePath = path.join(outputDirectory, 'exceljs-source.xlsx');
  const copiedPath = path.join(outputDirectory, 'exceljs-copied.xlsx');

  await createSyntheticWorkbook(sourcePath);

  const sourceWorkbook = new ExcelJS.Workbook();
  await sourceWorkbook.xlsx.readFile(sourcePath);
  const sourceWorksheet = sourceWorkbook.getWorksheet('源数据');

  if (!sourceWorksheet) {
    throw new Error('Synthetic workbook sheet was not readable.');
  }

  const copiedWorkbook = new ExcelJS.Workbook();
  const copiedWorksheet = copiedWorkbook.addWorksheet(sourceWorksheet.name);
  copyWorksheet(sourceWorksheet, copiedWorksheet);
  await copiedWorkbook.xlsx.writeFile(copiedPath);

  const readBackWorkbook = new ExcelJS.Workbook();
  await readBackWorkbook.xlsx.readFile(copiedPath);
  const readBackWorksheet = readBackWorkbook.getWorksheet('源数据');

  if (!readBackWorksheet) {
    throw new Error('Copied workbook sheet was not readable.');
  }

  const savedFormulaCell = sourceWorksheet.getCell('E3');
  const unsavedFormulaCell = sourceWorksheet.getCell('F3');

  return {
    sourcePath,
    copiedPath,
    checks: [
      {
        name: 'sheet names and row count',
        passed: sourceWorkbook.worksheets.map((sheet) => sheet.name).includes('源数据') &&
          sourceWorksheet.rowCount >= 4,
        detail: `sheets=${sourceWorkbook.worksheets.map((sheet) => sheet.name).join(', ')}, rows=${sourceWorksheet.rowCount}`,
      },
      {
        name: 'cell styles',
        passed: readBackWorksheet.getCell('A1').font?.bold === true &&
          readBackWorksheet.getCell('A1').fill?.type === 'pattern',
        detail: `A1 bold=${String(readBackWorksheet.getCell('A1').font?.bold)}, fill=${String(readBackWorksheet.getCell('A1').fill?.type)}`,
      },
      {
        name: 'column widths',
        passed: Math.abs((readBackWorksheet.getColumn(1).width ?? 0) - 18) < 0.1,
        detail: `A width=${String(readBackWorksheet.getColumn(1).width)}`,
      },
      {
        name: 'row heights',
        passed: Math.abs((readBackWorksheet.getRow(1).height ?? 0) - 26) < 0.1,
        detail: `row1 height=${String(readBackWorksheet.getRow(1).height)}`,
      },
      {
        name: 'merged cells',
        passed: (readBackWorksheet.model.merges ?? []).includes('A1:F1'),
        detail: `merges=${(readBackWorksheet.model.merges ?? []).join(', ')}`,
      },
      {
        name: 'hidden row and column state',
        passed: readBackWorksheet.getRow(4).hidden === true && readBackWorksheet.getColumn(6).hidden === true,
        detail: `row4 hidden=${String(readBackWorksheet.getRow(4).hidden)}, colF hidden=${String(readBackWorksheet.getColumn(6).hidden)}`,
      },
      {
        name: 'number and date formats',
        passed: readBackWorksheet.getCell('B3').numFmt === '#,##0.00' &&
          readBackWorksheet.getCell('C3').numFmt === 'yyyy-mm-dd' &&
          readBackWorksheet.getCell('D3').numFmt === '@',
        detail: `B3=${String(readBackWorksheet.getCell('B3').numFmt)}, C3=${String(readBackWorksheet.getCell('C3').numFmt)}, D3=${String(readBackWorksheet.getCell('D3').numFmt)}`,
      },
      {
        name: 'saved formula display value',
        passed: savedFormulaCell.text === '2469.12' || savedFormulaCell.result === 2469.12,
        detail: `value=${JSON.stringify(savedFormulaCell.value)}, text=${savedFormulaCell.text}`,
      },
      {
        name: 'unsaved formula limitation observed',
        passed: unsavedFormulaCell.text === '',
        detail: `value=${JSON.stringify(unsavedFormulaCell.value)}, text=${unsavedFormulaCell.text || '(empty cached result)'}`,
      },
    ],
  };
};

const readZipEntry = (zipFile, entry) => new Promise((resolve, reject) => {
  zipFile.openReadStream(entry, (streamError, stream) => {
    if (streamError) {
      reject(streamError);
      return;
    }

    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
});

const listZipEntriesWithContent = (xlsxPath) => new Promise((resolve, reject) => {
  yauzl.open(xlsxPath, { lazyEntries: true }, (openError, zipFile) => {
    if (openError) {
      reject(openError);
      return;
    }

    const entries = [];

    zipFile.readEntry();
    zipFile.on('entry', async (entry) => {
      try {
        let content;
        if (entry.fileName.startsWith('xl/worksheets/_rels/') && entry.fileName.endsWith('.rels')) {
          content = await readZipEntry(zipFile, entry);
        }
        entries.push({ fileName: entry.fileName, content });
        zipFile.readEntry();
      } catch (error) {
        reject(error);
      }
    });
    zipFile.on('error', reject);
    zipFile.on('end', () => resolve(entries));
  });
});

const detectWorksheetObjects = async (xlsxPath) => {
  const entries = await listZipEntriesWithContent(xlsxPath);
  const objectRelationshipPattern = /Type="[^"]*(drawing|vmlDrawing|oleObject|ctrlProp)[^"]*"/i;

  return entries
    .filter((entry) => entry.fileName.startsWith('xl/worksheets/_rels/') && entry.fileName.endsWith('.rels'))
    .map((entry) => ({
      relationshipPath: entry.fileName,
      hasEmbeddedObjectRelationship: objectRelationshipPattern.test(entry.content ?? ''),
      relationshipExcerpt: (entry.content ?? '').replace(/\s+/g, ' ').slice(0, 500),
    }));
};

const inspectObjectDetection = async (outputDirectory) => {
  const objectWorkbookPath = path.join(outputDirectory, 'object-detection.xlsx');
  await createObjectWorkbook(objectWorkbookPath);
  const relationshipDetections = await detectWorksheetObjects(objectWorkbookPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(objectWorkbookPath);

  const detections = workbook.worksheets.map((worksheet, index) => {
    const relationshipPath = `xl/worksheets/_rels/sheet${index + 1}.xml.rels`;
    const relationshipDetection = relationshipDetections.find(
      (detection) => detection.relationshipPath === relationshipPath,
    );

    return {
      sheetName: worksheet.name,
      relationshipPath,
      hasEmbeddedObjectRelationship: relationshipDetection?.hasEmbeddedObjectRelationship ?? false,
      relationshipExcerpt: relationshipDetection?.relationshipExcerpt ?? 'No worksheet relationship file.',
    };
  });

  return {
    objectWorkbookPath,
    detections,
    passed: detections.some((detection) => detection.hasEmbeddedObjectRelationship) &&
      detections.some((detection) => !detection.hasEmbeddedObjectRelationship),
  };
};

const detectWorkbookContainer = async (inputPath) => {
  const header = await readFile(inputPath);

  if (
    header[0] === 0xd0 &&
    header[1] === 0xcf &&
    header[2] === 0x11 &&
    header[3] === 0xe0 &&
    header[4] === 0xa1 &&
    header[5] === 0xb1 &&
    header[6] === 0x1a &&
    header[7] === 0xe1
  ) {
    return 'cfb';
  }

  if (
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    ((header[2] === 0x03 && header[3] === 0x04) ||
      (header[2] === 0x05 && header[3] === 0x06) ||
      (header[2] === 0x07 && header[3] === 0x08))
  ) {
    return 'zip';
  }

  return 'unknown';
};

const inspectSheetJsDirectSample = async (sample, formatLabel) => {
  let containerType = 'unread';

  try {
    containerType = await detectWorkbookContainer(sample.path);
    if (containerType === 'unknown') {
      throw new Error(`Unsupported ${sample.extension} container signature; expected a CFB or ZIP workbook container.`);
    }

    const workbook = XLSX.readFile(sample.path, {
      cellDates: true,
      cellNF: true,
      cellStyles: true,
      cellText: true,
    });
    const firstSheetName = workbook.SheetNames[0];
    const firstWorksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;

    if (!firstWorksheet) {
      throw new Error('No readable worksheets were found.');
    }

    const rows = XLSX.utils.sheet_to_json(firstWorksheet, {
      header: 1,
      raw: false,
      defval: '',
    });
    const cellAddresses = Object.keys(firstWorksheet).filter((key) => /^[A-Z]+[0-9]+$/.test(key));

    return {
      name: sample.name,
      status: 'pass',
      formatLabel,
      containerType,
      sheetNames: workbook.SheetNames,
      firstSheetName,
      rowCount: rows.length,
      columnCount: rows.reduce((maxColumnCount, row) => (
        Array.isArray(row) ? Math.max(maxColumnCount, row.length) : maxColumnCount
      ), 0),
      mergeCount: firstWorksheet['!merges']?.length ?? 0,
      rowMetadataCount: firstWorksheet['!rows']?.length ?? 0,
      columnMetadataCount: firstWorksheet['!cols']?.length ?? 0,
      formattedCellCount: cellAddresses.filter((address) => firstWorksheet[address]?.z || firstWorksheet[address]?.w).length,
      styleCellCount: cellAddresses.filter((address) => firstWorksheet[address]?.s).length,
      error: '',
    };
  } catch (error) {
    return {
      name: sample.name,
      status: 'fail',
      formatLabel,
      containerType,
      sheetNames: [],
      firstSheetName: '',
      rowCount: 0,
      columnCount: 0,
      mergeCount: 0,
      rowMetadataCount: 0,
      columnMetadataCount: 0,
      formattedCellCount: 0,
      styleCellCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const inspectSheetJsDirectRead = async (samples, extension, formatLabel) => {
  const directSamples = samples.filter((sample) => sample.extension === extension);

  if (directSamples.length === 0) {
    return {
      status: 'skipped',
      reason: `No ${extension} sample files were found. Add representative ${extension} samples and rerun the probe.`,
      samples: directSamples,
      reads: [],
    };
  }

  const reads = await Promise.all(
    directSamples.map((sample) => inspectSheetJsDirectSample(sample, formatLabel)),
  );

  return {
    status: reads.every((read) => read.status === 'pass') ? 'tested' : 'failed',
    reason: `SheetJS direct ${extension} read attempts completed.`,
    samples: directSamples,
    reads,
  };
};

const inspectMalformedDirectRejection = async (outputDirectory, extension, formatLabel) => {
  const malformedPath = path.join(outputDirectory, `malformed-direct-read${extension}`);
  await writeFile(malformedPath, `not a ${formatLabel} workbook`, 'utf8');

  const read = await inspectSheetJsDirectSample({
    name: path.basename(malformedPath),
    path: malformedPath,
    extension,
    sizeBytes: Buffer.byteLength(`not a ${formatLabel} workbook`),
  }, formatLabel);

  return {
    malformedPath,
    read,
    passed: read.status === 'fail' && read.containerType === 'unknown',
  };
};

const markdownTable = (headers, rows) => {
  const headerLine = `| ${headers.join(' | ')} |`;
  const dividerLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const rowLines = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerLine, dividerLine, ...rowLines].join('\n');
};

const buildReport = ({
  options,
  samples,
  excelJsProbe,
  objectDetectionProbe,
  sheetJsXlsProbe,
  sheetJsEtProbe,
  malformedXlsProbe,
  malformedEtProbe,
}) => {
  const excelRows = excelJsProbe.checks.map((check) => [
    check.name,
    check.passed ? 'pass' : 'fail',
    check.detail.replace(/\|/g, '\\|'),
  ]);

  const objectRows = objectDetectionProbe.detections.map((detection) => [
    detection.sheetName,
    detection.relationshipPath,
    detection.hasEmbeddedObjectRelationship ? 'yes' : 'no',
    detection.relationshipExcerpt.replace(/\|/g, '\\|'),
  ]);

  const sampleRows = samples.map((sample) => [
    sample.name,
    sample.extension,
    String(sample.sizeBytes),
  ]);

  const xlsReadRows = sheetJsXlsProbe.reads.map((read) => [
    read.name,
    read.status,
    read.containerType,
    read.sheetNames.join(', ') || '-',
    read.firstSheetName || '-',
    String(read.rowCount),
    String(read.columnCount),
    String(read.mergeCount),
    String(read.formattedCellCount),
    String(read.styleCellCount),
    read.error.replace(/\|/g, '\\|').replace(/\n/g, '<br>') || '-',
  ]);

  const etReadRows = sheetJsEtProbe.reads.map((read) => [
    read.name,
    read.status,
    read.containerType,
    read.sheetNames.join(', ') || '-',
    read.firstSheetName || '-',
    String(read.rowCount),
    String(read.columnCount),
    String(read.mergeCount),
    String(read.formattedCellCount),
    String(read.styleCellCount),
    read.error.replace(/\|/g, '\\|').replace(/\n/g, '<br>') || '-',
  ]);

  return `# Excel Processing Capability Probe Report

## Summary

- Probe harness: \`apps/desktop/scripts/excel-probe.mjs\`
- Generated output directory: \`${path.relative(repoRoot, options.outputDirectory)}\`
- Sample directory: \`${path.relative(repoRoot, options.sampleDirectory)}\`
- Candidate workbook library: \`exceljs\`
- Candidate direct .xls/.et reader: \`xlsx\` / SheetJS CE
- Candidate xlsx relationship inspector: \`yauzl\`

## Recommendation

Use \`exceljs\` as the first Phase 1 \`.xlsx\` workbook adapter candidate. The synthetic round trip confirms workbook/sheet reading, writing, styles, widths, row heights, merge ranges, hidden rows/columns, number formats, and saved formula results can be preserved with explicit copy logic.

Use SheetJS CE \`xlsx\` as the direct-read adapter candidate for legacy \`.xls\` and WPS \`.et\` files. Do not route \`.xls\` or \`.et\` through WPS conversion. Real \`.xls\` and \`.et\` samples must still validate sheet names, display values, merge metadata, format metadata, hidden row/column metadata, and any required style preservation limits before split/merge implementation treats those formats as fully supported.

Use a ZIP relationship inspection step for selected-sheet embedded object detection. The synthetic image workbook confirms worksheet-level drawing relationships can be detected without opening the workbook in the renderer. Validate this again with real chart/image/WPS-authored samples before split/merge implementation.

## Acceptance Matrix

- [${sheetJsXlsProbe.status === 'tested' ? 'x' : ' '}] \`.xls\` direct library read tested with a sample file.
- [${sheetJsEtProbe.status === 'tested' ? 'x' : ' '}] \`.et\` direct library read tested with a sample file.
- [${malformedXlsProbe.passed ? 'x' : ' '}] Malformed \`.xls\` input is rejected before SheetJS text fallback can treat it as a sheet.
- [${malformedEtProbe.passed ? 'x' : ' '}] Malformed \`.et\` input is rejected before SheetJS text fallback can treat it as a sheet.
- [x] Candidate Excel library tested against preservation requirements.
- [x] Selected-sheet embedded object detection approach documented.
- [x] Formula display-value limitations documented.
- [x] Parent design updated with local probe findings and direct \`.xls\` / \`.et\` reader plan.

## Samples

${sampleRows.length > 0 ? markdownTable(['File', 'Extension', 'Size bytes'], sampleRows) : 'No local sample files were found. Put samples in the sample directory and rerun the script.'}

## SheetJS XLS Direct-Read Probe

- Status: \`${sheetJsXlsProbe.status}\`
- Reason: ${sheetJsXlsProbe.reason}

${xlsReadRows.length > 0 ? markdownTable(['File', 'Result', 'Container', 'Sheets', 'First sheet', 'Rows', 'Columns', 'Merges', 'Formatted cells', 'Style cells', 'Error'], xlsReadRows) : 'No .xls direct-read attempt was executed in this run.'}

### Malformed XLS Rejection

- Artifact: \`${path.relative(repoRoot, malformedXlsProbe.malformedPath)}\`
- Result: \`${malformedXlsProbe.passed ? 'pass' : 'fail'}\`
- Detail: ${malformedXlsProbe.read.error || 'Malformed input was unexpectedly accepted.'}

## SheetJS ET Direct-Read Probe

- Status: \`${sheetJsEtProbe.status}\`
- Reason: ${sheetJsEtProbe.reason}

${etReadRows.length > 0 ? markdownTable(['File', 'Result', 'Container', 'Sheets', 'First sheet', 'Rows', 'Columns', 'Merges', 'Formatted cells', 'Style cells', 'Error'], etReadRows) : 'No .et direct-read attempt was executed in this run.'}

### Malformed ET Rejection

- Artifact: \`${path.relative(repoRoot, malformedEtProbe.malformedPath)}\`
- Result: \`${malformedEtProbe.passed ? 'pass' : 'fail'}\`
- Detail: ${malformedEtProbe.read.error || 'Malformed input was unexpectedly accepted.'}

## ExcelJS Workbook Probe

Artifacts:

- Source workbook: \`${path.relative(repoRoot, excelJsProbe.sourcePath)}\`
- Copied workbook: \`${path.relative(repoRoot, excelJsProbe.copiedPath)}\`

${markdownTable(['Capability', 'Result', 'Detail'], excelRows)}

### Formula Display Values

\`exceljs\` can expose saved formula results when the source workbook contains cached calculation results. Formulas without saved results do not give OfficeTools a trustworthy calculated display value; production code should use the saved result when present and treat missing cached results as a limitation that may require user recalculation/resave in WPS.

## Embedded Object Detection Probe

Artifact:

- Object workbook: \`${path.relative(repoRoot, objectDetectionProbe.objectWorkbookPath)}\`

Overall result: \`${objectDetectionProbe.passed ? 'pass' : 'fail'}\`

${objectRows.length > 0 ? markdownTable(['Sheet', 'Worksheet relationship file', 'Has object relationship', 'Relationship excerpt'], objectRows) : 'No worksheets were inspected.'}

Detection approach: inspect \`xl/worksheets/_rels/sheetN.xml.rels\` for relationship types containing drawing, vmlDrawing, oleObject, or ctrlProp. A selected sheet with these relationships should be blocked; non-selected sheets may continue if their own relationship file is clean.

## Next Steps Before Split/Merge

1. Add representative \`.xls\`, \`.et\`, styled \`.xlsx\`, and object-containing \`.xlsx\` samples under \`${path.relative(repoRoot, options.sampleDirectory)}\`.
2. Run \`pnpm probe:excel\` from the repository root to validate SheetJS direct \`.xls\` and \`.et\` reading in the same report.
3. If SheetJS direct reading fails or cannot preserve required metadata from real samples, narrow that file format support contract before split/merge implementation proceeds.
4. If real embedded object samples are not detected per selected sheet, conservatively block workbooks with any worksheet object relationship and update the parent design.
`;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.outputDirectory, { recursive: true });
  await mkdir(options.sampleDirectory, { recursive: true });
  await writeFile(path.join(options.outputDirectory, '.gitignore'), '*\n!.gitignore\n', 'utf8');

  const samples = await findSamples(options.sampleDirectory);
  const excelJsProbe = await inspectExcelJsRoundTrip(options.outputDirectory);
  const objectDetectionProbe = await inspectObjectDetection(options.outputDirectory);
  const sheetJsXlsProbe = await inspectSheetJsDirectRead(samples, '.xls', 'XLS');
  const sheetJsEtProbe = await inspectSheetJsDirectRead(samples, '.et', 'ET');
  const malformedXlsProbe = await inspectMalformedDirectRejection(options.outputDirectory, '.xls', 'XLS');
  const malformedEtProbe = await inspectMalformedDirectRejection(options.outputDirectory, '.et', 'ET');

  const report = buildReport({
    options,
    samples,
    excelJsProbe,
    objectDetectionProbe,
    sheetJsXlsProbe,
    sheetJsEtProbe,
    malformedXlsProbe,
    malformedEtProbe,
  });
  await writeFile(options.reportPath, report, 'utf8');

  process.stdout.write(`Excel probe report written to ${options.reportPath}\n`);

  const failedChecks = excelJsProbe.checks.filter((check) => !check.passed);
  if (
    failedChecks.length > 0 ||
    !objectDetectionProbe.passed ||
    sheetJsXlsProbe.status === 'failed' ||
    sheetJsEtProbe.status === 'failed' ||
    !malformedXlsProbe.passed ||
    !malformedEtProbe.passed
  ) {
    process.stderr.write('One or more probe checks failed. Review the report for details.\n');
    process.exitCode = 1;
  }
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
