import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

const ZIP_SIGNATURE = '504b';
const CFB_SIGNATURE = 'd0cf11e0a1b11ae1';
const BOF_RECORD_ID = 0x0809;
const EOF_RECORD_ID = 0x000a;
const BOUND_SHEET_RECORD_ID = 0x0085;
const OBJECT_RELATIONSHIP_MARKERS = ['drawing', 'vmlDrawing', 'oleObject', 'ctrlProp'];
const OBJECT_CFB_PATH_MARKERS = ['embeddings', 'oleobjects', 'drawings', 'activex', 'ctrlprops'];
const LEGACY_OBJECT_RECORD_IDS = new Map<number, string>([
  [0x005d, 'OBJ'],
  [0x007f, 'IMDATA'],
  [0x00eb, 'MSODRAWINGGROUP'],
  [0x00ec, 'MSODRAWING'],
  [0x00ed, 'MSODRAWINGSELECTION'],
  [0x01b6, 'TXO'],
]);

const UNSUPPORTED_OBJECT_MESSAGE = '所选 sheet 含有图片、图表或其他嵌入对象，暂不支持拆分';
const UNCERTAIN_OBJECT_MESSAGE = '无法确认所选 sheet 是否含有嵌入对象，请另存为 .xlsx 后重试';

type CfbEntry = {
  content?: Uint8Array;
  name?: string;
  type?: number;
};

type CfbContainer = {
  FileIndex?: CfbEntry[];
  FullPaths?: string[];
};

type BoundSheet = {
  name: string;
  offset: number;
  type: number;
};

type BiffRecord = {
  dataEnd: number;
  dataStart: number;
  id: number;
  offset: number;
  size: number;
};

const getContainerSignature = (buffer: Buffer): string => {
  return buffer.subarray(0, 8).toString('hex').toLowerCase();
};

const isZipContainer = (buffer: Buffer): boolean => {
  return getContainerSignature(buffer).startsWith(ZIP_SIGNATURE);
};

const isCfbContainer = (buffer: Buffer): boolean => {
  return getContainerSignature(buffer) === CFB_SIGNATURE;
};

const readBiffRecord = (stream: Buffer, offset: number): BiffRecord | undefined => {
  if (offset + 4 > stream.length) {
    return undefined;
  }

  const id = stream.readUInt16LE(offset);
  const size = stream.readUInt16LE(offset + 2);
  const dataStart = offset + 4;
  const dataEnd = dataStart + size;
  if (dataEnd > stream.length) {
    return undefined;
  }

  return {
    dataEnd,
    dataStart,
    id,
    offset,
    size,
  };
};

const decodeBoundSheetName = (recordData: Buffer): string => {
  if (recordData.length < 8) {
    return '';
  }

  const characterCount = recordData.readUInt8(6);
  const flags = recordData.readUInt8(7);
  const isUtf16 = (flags & 0x01) === 1;
  const nameStart = 8;
  const byteLength = isUtf16 ? characterCount * 2 : characterCount;
  const nameEnd = Math.min(nameStart + byteLength, recordData.length);
  const nameBuffer = recordData.subarray(nameStart, nameEnd);
  return isUtf16 ? nameBuffer.toString('utf16le') : nameBuffer.toString('latin1');
};

const parseBoundSheets = (workbookStream: Buffer): BoundSheet[] => {
  const sheets: BoundSheet[] = [];
  let offset = 0;

  while (offset < workbookStream.length) {
    const record = readBiffRecord(workbookStream, offset);
    if (!record) {
      break;
    }

    if (record.id === BOUND_SHEET_RECORD_ID && record.size >= 8) {
      const recordData = workbookStream.subarray(record.dataStart, record.dataEnd);
      sheets.push({
        name: decodeBoundSheetName(recordData),
        offset: recordData.readUInt32LE(0),
        type: recordData.readUInt8(5),
      });
    }

    offset = record.dataEnd;
  }

  return sheets;
};

const findSelectedBoundSheet = (
  boundSheets: BoundSheet[],
  selectedSheetName: string,
  workbookSheetNames: string[],
): BoundSheet | undefined => {
  const exactMatch = boundSheets.find((sheet) => sheet.name === selectedSheetName);
  if (exactMatch) {
    return exactMatch;
  }

  const selectedSheetIndex = workbookSheetNames.indexOf(selectedSheetName);
  if (selectedSheetIndex < 0) {
    return undefined;
  }

  return boundSheets[selectedSheetIndex];
};

const hasLegacyObjectRecordInSheet = (workbookStream: Buffer, sheetOffset: number): boolean => {
  let offset = sheetOffset;
  let sawBof = false;

  while (offset < workbookStream.length) {
    const record = readBiffRecord(workbookStream, offset);
    if (!record) {
      throw new Error(UNCERTAIN_OBJECT_MESSAGE);
    }

    if (!sawBof) {
      if (record.id !== BOF_RECORD_ID) {
        throw new Error(UNCERTAIN_OBJECT_MESSAGE);
      }
      sawBof = true;
    } else if (record.id === EOF_RECORD_ID) {
      return false;
    }

    if (LEGACY_OBJECT_RECORD_IDS.has(record.id)) {
      return true;
    }

    offset = record.dataEnd;
  }

  throw new Error(UNCERTAIN_OBJECT_MESSAGE);
};

const getWorkbookStream = (cfb: CfbContainer): Buffer => {
  const workbookEntry = XLSX.CFB.find(cfb, '/Workbook') as CfbEntry | undefined;
  const bookEntry = XLSX.CFB.find(cfb, '/Book') as CfbEntry | undefined;
  const entry = workbookEntry ?? bookEntry;
  if (!entry?.content) {
    throw new Error(UNCERTAIN_OBJECT_MESSAGE);
  }

  return Buffer.from(entry.content);
};

const hasWorkbookLevelObjectStorage = (cfb: CfbContainer): boolean => {
  const fullPaths = cfb.FullPaths ?? [];
  return fullPaths.some((fullPath) => {
    const normalizedPath = fullPath.toLowerCase();
    return OBJECT_CFB_PATH_MARKERS.some((marker) => normalizedPath.includes(marker));
  });
};

const assertNoZipSelectedSheetObjects = async (
  workbookBuffer: Buffer,
  selectedSheetName: string,
  workbookSheetNames: string[],
): Promise<void> => {
  const sheetIndex = workbookSheetNames.indexOf(selectedSheetName);
  if (sheetIndex < 0) {
    throw new Error(UNCERTAIN_OBJECT_MESSAGE);
  }

  const zip = await JSZip.loadAsync(workbookBuffer);
  const relationshipFile = zip.file(`xl/worksheets/_rels/sheet${sheetIndex + 1}.xml.rels`);
  if (!relationshipFile) {
    return;
  }

  const relationshipText = await relationshipFile.async('string');
  const hasObjects = OBJECT_RELATIONSHIP_MARKERS.some((marker) => relationshipText.includes(marker));
  if (hasObjects) {
    throw new Error(UNSUPPORTED_OBJECT_MESSAGE);
  }
};

const assertNoCfbSelectedSheetObjects = (
  workbookBuffer: Buffer,
  selectedSheetName: string,
  workbookSheetNames: string[],
): void => {
  const cfb = XLSX.CFB.read(workbookBuffer, { type: 'buffer' }) as CfbContainer;
  const workbookStream = getWorkbookStream(cfb);
  const boundSheets = parseBoundSheets(workbookStream);
  const selectedSheet = findSelectedBoundSheet(boundSheets, selectedSheetName, workbookSheetNames);

  if (!selectedSheet) {
    throw new Error(UNCERTAIN_OBJECT_MESSAGE);
  }

  if (selectedSheet.type !== 0x00) {
    throw new Error(UNSUPPORTED_OBJECT_MESSAGE);
  }

  if (selectedSheet.offset < 0 || selectedSheet.offset >= workbookStream.length) {
    throw new Error(UNCERTAIN_OBJECT_MESSAGE);
  }

  if (hasLegacyObjectRecordInSheet(workbookStream, selectedSheet.offset)) {
    throw new Error(UNSUPPORTED_OBJECT_MESSAGE);
  }

  if (hasWorkbookLevelObjectStorage(cfb)) {
    throw new Error(UNCERTAIN_OBJECT_MESSAGE);
  }
};

export const assertNoUnsupportedObjectsInDirectWorkbook = async (
  workbookPath: string,
  selectedSheetName: string,
  workbookSheetNames: string[],
): Promise<void> => {
  const workbookBuffer = await readFile(workbookPath);

  if (isZipContainer(workbookBuffer)) {
    await assertNoZipSelectedSheetObjects(workbookBuffer, selectedSheetName, workbookSheetNames);
    return;
  }

  if (isCfbContainer(workbookBuffer)) {
    assertNoCfbSelectedSheetObjects(workbookBuffer, selectedSheetName, workbookSheetNames);
    return;
  }

  throw new Error(UNCERTAIN_OBJECT_MESSAGE);
};
