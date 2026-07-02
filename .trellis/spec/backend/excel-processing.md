# Excel Processing

OfficeTools Phase 1 Excel processing is implemented behind main-process adapter boundaries. Renderer code should never open workbooks or inspect local files directly.

Reference files and artifacts:

- `apps/desktop/scripts/excel-probe.mjs`
- `.trellis/tasks/06-28-excel-processing-probe/report.md`
- `.trellis/tasks/06-28-office-tools-phase1/design.md`
- `apps/desktop/src/main/services/workspace/temp-workspace.ts`
- `apps/desktop/src/main/services/file-selection/file-registry.ts`
- `apps/desktop/src/main/services/excel/legacy-object-detector.ts`

## Scenario: Workbook Adapters And Direct Readers

### 1. Scope / Trigger

Use this spec when implementing Excel parse, split, merge, conversion, object detection, or sample-processing tests.

The probe selected:

- `exceljs` as the first `.xlsx` workbook adapter candidate.
- SheetJS CE `xlsx` as the direct `.xls` / `.et` reader candidate.
- `yauzl` relationship inspection for selected-sheet embedded object detection.

### 2. Signatures

Production modules should keep these adapter shapes or equivalent contracts:

```typescript
type WorkbookAdapter = {
  openWorkbook: (inputPath: string) => Promise<WorkbookHandle>;
  readSheetMetadata: (workbook: WorkbookHandle) => Promise<SheetMetadata[]>;
  copyRangeToWorkbook: (input: CopyRangeInput) => Promise<void>;
  writeWorkbook: (workbook: WorkbookHandle, outputPath: string) => Promise<void>;
};

type DirectWorkbookReader = {
  openLegacyWorkbook: (inputPath: string) => Promise<WorkbookHandle>;
  readSheetMetadata: (workbook: WorkbookHandle) => Promise<SheetMetadata[]>;
  readDisplayRows: (input: ReadDisplayRowsInput) => Promise<DisplayRow[]>;
};

type UnsupportedObjectDetector = {
  hasSelectedSheetObjects: (xlsxPath: string, sheetIndex: number) => Promise<boolean>;
};
```

The exact type names may evolve, but the responsibilities should stay separate.

### 3. Contracts

- Inputs to workbook adapters are real local paths resolved in the main process from `sourceId` registries or temp workspaces.
- `.xlsx` files may go directly into the workbook adapter.
- `.xls` files must go through the direct `.xls` reader adapter; do not convert `.xls` through WPS.
- `.et` files must go through the direct `.et` reader adapter; do not convert `.et` through WPS.
- The direct `.xls` / `.et` reader must preflight the file container signature and reject unknown/text-like files before accepting a SheetJS result. SheetJS may parse arbitrary text as a single-sheet workbook.
- Direct `.xls` parsing must load SheetJS codepage tables so non-ASCII legacy workbooks decode correctly.
- Output files are always `.xlsx`.
- Temporary processing files belong under a per-job temp workspace and must be cleaned after success, failure, or cancellation.
- Formula output uses cached calculated results. If a formula cell has no cached result, the feature must warn/skip rather than pretending it has a calculated display value.
- Selected-sheet object detection checks only the selected worksheet where possible. Non-selected sheets with object relationships do not block processing. Direct `.xls` / `.et` files only need blocking detection, not object preservation: ZIP-like files use worksheet relationship inspection, CFB/BIFF files scan the selected sheet BIFF substream for object/drawing records, and uncertain ownership fails closed.

### 4. Validation & Error Matrix

| Condition | Expected Behavior |
| --- | --- |
| Direct `.xls` reader cannot open workbook | Return a typed failure that tells the user to manually convert to `.xlsx`; batch jobs skip the current file and continue. |
| Direct `.et` reader cannot open workbook | Return a typed failure that tells the user to manually convert to `.xlsx`; batch jobs skip the current file and continue. |
| `.xls` or `.et` file has an unknown/text-like container signature | Reject before SheetJS generic text fallback; tell the user to manually convert to `.xlsx`. |
| Direct `.xls` or `.et` reader lacks required metadata in validation samples | Narrow that format support contract before split/merge implementation proceeds. |
| `exceljs` cannot open workbook | Mark file failed/skipped with a user-facing log. |
| Selected sheet has drawing/vml/ole/control relationship | Block that file as unsupported. |
| Direct `.xls` / `.et` selected sheet contains OBJ, IMDATA, MSODRAWING, MSODRAWINGSELECTION, or text-object records | Block that file as unsupported. |
| Direct `.xls` / `.et` object ownership cannot be mapped to the selected sheet | Fail closed and ask the user to save as `.xlsx`. |
| Non-selected sheet has object relationship only | Continue processing selected sheet. |
| Formula has cached result | Use cached result/display text. |
| Formula has no cached result | Warn or skip according to task PRD; do not output the formula string as the display value. |
| Job is canceled | Abort remaining files, delete temp workspace, and produce no final output. |

### 5. Good/Base/Bad Cases

- Good: `.xlsx` with styles, widths, heights, merges, hidden rows/columns, number formats, and cached formula results round-trips through `exceljs` copy logic.
- Base: `.xlsx` with no embedded object relationships on the selected sheet processes normally.
- Bad: selected worksheet `.rels` contains a drawing relationship; the file is blocked before output generation.
- Bad: selected `.xls` / `.et` BIFF sheet substream contains legacy object/drawing records; the file is blocked before output generation.
- Bad: a CFB workbook has object storage that cannot be mapped to a selected sheet; the file is blocked with a save-as-`.xlsx` message.
- Good: representative `.xls` and `.et` samples expose sheet names, display rows, merge metadata, format metadata, and hidden row/column metadata through the direct reader.
- Bad: a text file renamed to `.xls` or `.et` is rejected by container preflight instead of being accepted as a one-cell SheetJS workbook.
- Bad: `.xls` or `.et` direct reading fails; the app asks the user to manually convert to `.xlsx` and skips that file.

### 6. Tests Required

Before implementing split/merge on top of these adapters, run:

```bash
pnpm probe:excel
```

SheetJS `.xls` and `.et` direct-read validation runs whenever samples are present.

Assertions to preserve in automated or manual checks:

- style, fill, font, number/date format, column width, row height, merged cells, and hidden state survive output generation;
- cached formula result is used instead of formula text;
- missing formula result is surfaced as a limitation;
- selected-sheet object relationship blocks the file;
- direct `.xls` / `.et` legacy object records block the file, and uncertain ownership fails closed;
- SheetJS direct reading opens representative `.xls` and `.et` samples and exposes required metadata, or the relevant support contract is narrowed before split/merge implementation proceeds.
- Malformed/text-like `.xls` and `.et` inputs are rejected before SheetJS generic text fallback can turn them into single-sheet workbooks.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Renderer receives a real path and opens workbook-like data itself.
await window.someFileApi.read('/home/user/source.xls');

// XLS or ET is routed through WPS conversion even though the plan requires direct reading.
await wpsConverter.convertXlsToXlsx('/home/user/source.xls', tempDir);

// A SheetJS read result is accepted without checking whether the input was a workbook container.
const workbook = await directWorkbookReader.openLegacyWorkbook('/home/user/not-really.xls');

// Formula without cached result is treated as a display value.
outputCell.value = formulaCell.value.formula;
```

#### Correct

```typescript
// Renderer stores sourceId; main process resolves the real path and runs adapters.
const sourcePath = getRegisteredFilePath(sourceId);
const workbook = sourcePath.endsWith('.xls') || sourcePath.endsWith('.et')
  ? await directWorkbookReader.openAfterContainerPreflight(sourcePath)
  : await workbookAdapter.openWorkbook(sourcePath);

// Formula cells use saved calculated results only.
if (formulaResult === undefined) {
  return { success: false, error: '公式缺少已保存的计算结果', code: 'MISSING_FORMULA_RESULT' };
}
```


## Scenario: Split Job Output Generation

### 1. Scope / Trigger

Use this spec when implementing or changing the production split workflow from renderer settings through main-process output generation. This is a cross-layer contract because it changes shared Zod input, preload API, IPC handler behavior, job events, filesystem output, and renderer state.

### 2. Signatures

Current shared contracts live in `apps/desktop/src/shared/types/excel.ts`:

```typescript
const startSplitJobInputSchema = z.object({
  outputDirectory: z.string().min(1),
  files: z.array(z.object({
    sourceId: z.string().min(1),
    sheetName: z.string().min(1),
    fieldRow: z.number().int().min(1).max(10),
    splitColumn: z.number().int().min(1),
  })).min(1),
});

type SplitJobResult = {
  outputDirectory: string;
  outputPath: string;
  files: SplitJobFileResult[];
};
```

The preload API is `window.officeTools.excel.startSplitJob(input)` and the IPC channel is `IPC_CHANNELS.EXCEL.START_SPLIT_JOB`.

### 3. Contracts

- Renderer sends only `sourceId`, selected sheet name, numeric field row, numeric split column, and output directory. It does not send source paths.
- Main process resolves each `sourceId` through `getRegisteredFilePath`.
- `.xlsx` split output uses `exceljs` and copies title rows, selected data rows, styles, column widths, row heights, hidden state, number formats, and title-area merged cells.
- `.xls` and `.et` split output uses SheetJS CE direct reading without WPS conversion and writes `.xlsx` output files.
- The split value is the selected-column display text. Empty display text writes to `原文件名_空值.xlsx`.
- File name parts replace illegal filename characters with `_`; duplicate output names and duplicate source folders get numeric suffixes.
- One batch writes one `总拆分结果.zip` under the selected output directory. If the zip already exists, append a numeric suffix.
- Each input file gets its own folder inside the zip. Temporary folders must be keyed by `sourceId` so two same-named source files cannot overwrite each other before zipping.
- Job progress, logs, and per-file status changes are emitted through `IPC_CHANNELS.JOB.EVENT`.

### 4. Validation & Error Matrix

| Condition | Expected Behavior |
| --- | --- |
| Invalid split job payload | `ApiResult` failure with `INVALID_SPLIT_JOB_INPUT`. |
| `sourceId` no longer resolves | Mark that file failed and continue batch. |
| Selected sheet missing | Mark that file failed and continue batch. |
| Selected `.xlsx` sheet has drawing/vml/ole/control relationship | Mark that file failed and continue batch. |
| Formula cell has no cached result | Mark that file failed; do not output formula text. |
| A source file would produce more than `APP_CONFIG.LIMITS.MAX_SPLIT_OUTPUT_FILES` outputs | Mark that file failed with a user-facing limit message. |
| File has no non-empty data rows after the field row | Mark that file skipped and continue batch. |
| All files fail or skip with no outputs | Return `SPLIT_JOB_FAILED` and produce no zip. |
| User cancels all | Abort remaining work, delete temp workspace, return `JOB_CANCELED`, and produce no zip. |
| User skips current file | Mark current file skipped and continue later files when the service reaches an interruption check. |

### 5. Good/Base/Bad Cases

- Good: one styled `.xlsx` source produces `总拆分结果.zip/sourceName/sourceName_value.xlsx` and preserves the title area and formatting.
- Good: two same-named source files from different directories produce separate zip folders such as `sourceName/` and `sourceName_2/`.
- Base: a direct `.xls` or `.et` file with readable SheetJS metadata is split without WPS conversion and writes `.xlsx` outputs.
- Bad: a selected `.xlsx` sheet with a drawing relationship is blocked before writing output files.
- Bad: a renamed text file with `.xls` or `.et` extension is rejected by container preflight before SheetJS generic text fallback can accept it.

### 6. Tests Required

Run these before reporting split changes complete:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm probe:excel
```

Manual or automated sample assertions must cover:

- normal `.xlsx` split;
- merged-title `.xlsx` split;
- styled/date/long-number `.xlsx` split;
- direct `.xls` split when representative samples exist;
- direct `.et` split when representative samples exist;
- selected-sheet object rejection for `.xlsx` and direct `.xls` / `.et` legacy object records;
- cancel-all cleanup and no zip output;
- duplicate source-name folder suffixes and duplicate split-value filename suffixes.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Renderer simulates completion and never asks the main process to write files.
window.setTimeout(() => finishSplitJob(), 900);

// Same-named source files share a temp folder and can overwrite each other.
const outputFolderPath = path.join(workspace.rootPath, sourceBaseName);
```

#### Correct

```typescript
const result = await window.officeTools.excel.startSplitJob({
  outputDirectory,
  files: [{ sourceId, sheetName, fieldRow, splitColumn }],
});

const outputFolderPath = path.join(workspace.rootPath, sourceId);
```


## Scenario: Merge Job Output Generation

### 1. Scope / Trigger

Use this spec when implementing or changing the production merge workflow from folder scan through output workbook generation. This is a cross-layer contract because it changes shared Zod input, preload API, IPC handler behavior, job events, filesystem output, and renderer state.

### 2. Signatures

Current shared contracts live in `apps/desktop/src/shared/types/excel.ts`:

```typescript
const parseMergeFolderInputSchema = z.object({
  folderSourceId: z.string().min(1),
});

const startMergeJobInputSchema = z.object({
  outputDirectory: z.string().min(1),
  mode: z.enum(['single-sheet', 'multi-sheet']),
  fieldRow: z.number().int().min(1).max(10),
  files: z.array(z.object({
    sourceId: z.string().min(1),
    sheetName: z.string().min(1),
  })).min(1),
});
```

The preload API is `window.officeTools.excel.parseMergeFolder(input)` and `window.officeTools.excel.startMergeJob(input)`. The IPC channels are `IPC_CHANNELS.EXCEL.PARSE_MERGE_FOLDER` and `IPC_CHANNELS.EXCEL.START_MERGE_JOB`.

### 3. Contracts

- Renderer stores selected folder and file metadata by `sourceId`; main-process services resolve real paths through the registry.
- Folder scan recursively keeps `.xls`, `.xlsx`, and `.et` files, excludes files over 10 MB, caps to `APP_CONFIG.LIMITS.MAX_FILES`, registers eligible files, and parses workbook metadata.
- `.xlsx` merge input uses `exceljs`; `.xls` and `.et` merge input uses SheetJS CE direct reading without WPS conversion.
- Direct `.xls` / `.et` merge input preflights the file container signature before accepting SheetJS output.
- Selected-sheet unsupported-object rejection blocks only the selected sheet where ownership can be determined. Direct `.xls` / `.et` object detection is blocking only and does not preserve embedded objects.
- One-sheet merge treats rows `1..fieldRow` as the title area and rows after `fieldRow` as data rows. Empty rows between data rows are copied because row numbers are preserved when later rows exist.
- One-sheet merge compares field-row display values after trimming and ignoring trailing empty columns. If all headers match, only the first file contributes title rows; later files contribute data rows only.
- If any selected header differs, every valid file contributes its title area and data rows, and the job emits/returns `选择的文件具有标题行内容不一致，已保留标题行追加合并。`.
- One-sheet merge uses the first valid file's column metadata. Row/cell values, cached formula results, row height/hidden/outline metadata, cell number formats, and available styles are copied into the output workbook.
- Multi-sheet merge creates one output sheet per valid source file, using the source filename base as the sheet name. Names are sanitized, truncated to 31 characters, and de-duplicated with numeric suffixes.
- Merge output writes a single `.xlsx` workbook named `汇总数据.xlsx`; existing files get numeric suffixes.
- Final output is written through a per-job temp workspace first, then copied to the selected output directory only after the job has not been canceled.
- Job progress, logs, and per-file status changes are emitted through `IPC_CHANNELS.JOB.EVENT` with `tab: 'merge'`.

### 4. Validation & Error Matrix

| Condition | Expected Behavior |
| --- | --- |
| Invalid merge folder parse payload | `ApiResult` failure with `INVALID_MERGE_PARSE_INPUT`. |
| Invalid merge job payload | `ApiResult` failure with `INVALID_MERGE_JOB_INPUT`. |
| Folder source ID no longer resolves | `ApiResult` failure with `MERGE_PARSE_FAILED`. |
| File exceeds 10 MB during scan | Exclude it from configurable files and return an excluded-file warning. |
| Direct `.xls` / `.et` metadata parse fails during scan | Return a parse failure so the renderer warns the user and skips the file. |
| Source ID no longer resolves during merge | Mark that file failed and continue batch. |
| Selected sheet missing | Mark that file failed and continue batch. |
| Selected sheet has drawing/vml/ole/control relationship | Mark that file failed and continue batch. |
| Formula cell has no cached result | Mark that file failed; do not output formula text. |
| All files fail | Return `MERGE_JOB_FAILED` and produce no workbook. |
| User cancels all | Abort remaining work, delete temp workspace, return `JOB_CANCELED`, and produce no final output. |

### 5. Tests Required

Before reporting merge changes complete, run:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm probe:excel
```

Manual or automated sample assertions should cover:

- normal `.xlsx` one-sheet merge with matching headers;
- differing-header one-sheet merge and the required warning text;
- empty rows preserved between copied data rows;
- multi-sheet merge with filename-based sheet truncation and duplicate suffixes;
- direct `.xls` merge when representative samples exist;
- direct `.et` merge when representative samples exist;
- selected-sheet object rejection for `.xlsx` and direct `.xls` / `.et` legacy object records;
- cancel-all cleanup and no final workbook;
- duplicate `汇总数据.xlsx` output suffixing.

### 6. Wrong vs Correct

#### Wrong

```typescript
// Renderer sends source paths or opens workbook data itself.
await window.officeTools.excel.startMergeJob({ files: [{ path: '/home/user/source.xls' }] });

// Legacy formats are routed through WPS conversion.
await wpsConverter.convertXlsToXlsx(sourcePath, tempDir);

// The final output path is written before cancellation is checked.
await workbook.xlsx.writeFile(outputPath);
```

#### Correct

```typescript
const result = await window.officeTools.excel.startMergeJob({
  outputDirectory,
  mode: 'single-sheet',
  fieldRow: 1,
  files: [{ sourceId, sheetName }],
});
```

## Probe Harness

The probe script is development tooling, not production UI. It writes:

- `.trellis/tasks/06-28-excel-processing-probe/report.md`
- generated local workbooks under `.trellis/tasks/06-28-excel-processing-probe/probe-output/`

`probe-output/` is intentionally ignored except for its `.gitignore` file.

## Excel Reader Runtime Contracts

### 1. Scope / Trigger
- Trigger this contract when adding or changing code that reads workbook metadata or workbook contents with ExcelJS or SheetJS.
- Applies to `.xlsx` metadata previews, split jobs, merge jobs, and direct `.xls` / `.et` reading.

### 2. Signatures
- Safe ExcelJS text helper: `readExcelJsCellText(cell: ExcelJS.Cell): string` from `src/main/services/excel/cell-text.ts`.
- SheetJS runtime setup in every main-process module that calls `XLSX.readFile(...)`:
  - `import * as nodeFs from 'node:fs'`
  - `XLSX.set_fs(nodeFs)`
  - `XLSX.set_cptable(cpexcel)`

### 3. Contracts
- Do not call `cell.text` for ExcelJS user-file preview/grouping text. ExcelJS delegates to internal `toString()` implementations that can throw when malformed or nullable workbook values are present.
- Use `readExcelJsCellText(...)` for ExcelJS display text. It must return `''` for `null` / `undefined`, formula results with `null`, and unrecognized object values.
- Any file that calls `XLSX.readFile(...)` must call `XLSX.set_fs(nodeFs)` at module initialization. The SheetJS ESM build cannot access Node files in packaged Electron without this injection.
- Keep direct `.xls` / `.et` container signature checks before parsing so unsupported content fails with a user-facing format message instead of a low-level parser error.

### 4. Validation & Error Matrix
| Condition | Expected Behavior |
| --- | --- |
| `.xlsx` cell value is `null` or malformed formula result is `null` | Preview/grouping text is `''`; no `toString` crash. |
| ExcelJS object value is unrecognized | Preview/grouping text is `''`; do not expose `[object Object]`. |
| SheetJS module omits `XLSX.set_fs(nodeFs)` | `.xls` / `.et` read can fail with `Cannot access file <path>` in packaged/runtime tests. |
| Direct `.xls` / `.et` signature is invalid | Return the existing format error asking the user to save as `.xlsx`. |

### 5. Good/Base/Bad Cases
- Good: metadata parse registers temp `.xlsx`, `.xls`, and `.et` files, then `parseSplitDocumentMetadata(...)` returns three workbooks and no failures.
- Base: a pure `.xlsx` workbook with blank cells previews blanks as empty strings.
- Bad: a parser catches `Cannot read properties of null (reading 'toString')` and only rewrites the message while still using `cell.text`.

### 6. Tests Required
- Run `pnpm --filter @office-tools/desktop test:functional` after changing Excel reader setup or cell text helpers.
- Functional coverage must include nullable `.xlsx` cells plus `.xls` and `.et` metadata parsing.
- Run `pnpm typecheck` and `pnpm lint` before reporting completion.

### 7. Wrong vs Correct

#### Wrong

```typescript
const displayText = cell.text;
const workbook = XLSX.readFile(sourcePath, options);
```

#### Correct

```typescript
XLSX.set_fs(nodeFs);
XLSX.set_cptable(cpexcel);
const displayText = readExcelJsCellText(cell);
const workbook = XLSX.readFile(sourcePath, options);
```
