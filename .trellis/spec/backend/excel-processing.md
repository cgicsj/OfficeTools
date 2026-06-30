# Excel Processing

OfficeTools Phase 1 Excel processing is implemented behind main-process adapter boundaries. Renderer code should never open workbooks or inspect local files directly.

Reference files and artifacts:

- `apps/desktop/scripts/excel-probe.mjs`
- `.trellis/tasks/06-28-excel-processing-probe/report.md`
- `.trellis/tasks/06-28-office-tools-phase1/design.md`
- `apps/desktop/src/main/services/workspace/temp-workspace.ts`
- `apps/desktop/src/main/services/file-selection/file-registry.ts`

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
- Selected-sheet object detection checks only the selected worksheet where possible. Non-selected sheets with object relationships do not block processing.

### 4. Validation & Error Matrix

| Condition | Expected Behavior |
| --- | --- |
| Direct `.xls` reader cannot open workbook | Return a typed failure that tells the user to manually convert to `.xlsx`; batch jobs skip the current file and continue. |
| Direct `.et` reader cannot open workbook | Return a typed failure that tells the user to manually convert to `.xlsx`; batch jobs skip the current file and continue. |
| `.xls` or `.et` file has an unknown/text-like container signature | Reject before SheetJS generic text fallback; tell the user to manually convert to `.xlsx`. |
| Direct `.xls` or `.et` reader lacks required metadata in validation samples | Narrow that format support contract before split/merge implementation proceeds. |
| `exceljs` cannot open workbook | Mark file failed/skipped with a user-facing log. |
| Selected sheet has drawing/vml/ole/control relationship | Block that file as unsupported. |
| Non-selected sheet has object relationship only | Continue processing selected sheet. |
| Formula has cached result | Use cached result/display text. |
| Formula has no cached result | Warn or skip according to task PRD; do not output the formula string as the display value. |
| Job is canceled | Abort remaining files, delete temp workspace, and produce no final output. |

### 5. Good/Base/Bad Cases

- Good: `.xlsx` with styles, widths, heights, merges, hidden rows/columns, number formats, and cached formula results round-trips through `exceljs` copy logic.
- Base: `.xlsx` with no embedded object relationships on the selected sheet processes normally.
- Bad: selected worksheet `.rels` contains a drawing relationship; the file is blocked before output generation.
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

## Probe Harness

The probe script is development tooling, not production UI. It writes:

- `.trellis/tasks/06-28-excel-processing-probe/report.md`
- generated local workbooks under `.trellis/tasks/06-28-excel-processing-probe/probe-output/`

`probe-output/` is intentionally ignored except for its `.gitignore` file.
