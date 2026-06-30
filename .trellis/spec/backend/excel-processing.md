# Excel Processing

OfficeTools Phase 1 Excel processing is implemented behind main-process adapter boundaries. Renderer code should never open workbooks or inspect local files directly.

Reference files and artifacts:

- `apps/desktop/scripts/excel-probe.mjs`
- `.trellis/tasks/06-28-excel-processing-probe/report.md`
- `.trellis/tasks/06-28-office-tools-phase1/design.md`
- `apps/desktop/src/main/services/workspace/temp-workspace.ts`
- `apps/desktop/src/main/services/file-selection/file-registry.ts`

## Scenario: Workbook Adapter and Conversion Gate

### 1. Scope / Trigger

Use this spec when implementing Excel parse, split, merge, conversion, object detection, or sample-processing tests.

The probe selected:

- `exceljs` as the first `.xlsx` workbook adapter candidate.
- SheetJS CE `xlsx` as the direct `.et` reader candidate.
- `yauzl` relationship inspection for selected-sheet embedded object detection.
- WPS command conversion as a target-machine validation gate for `.xls` only.

### 2. Signatures

Production modules should keep these adapter shapes or equivalent contracts:

```typescript
type WorkbookAdapter = {
  openWorkbook: (inputPath: string) => Promise<WorkbookHandle>;
  readSheetMetadata: (workbook: WorkbookHandle) => Promise<SheetMetadata[]>;
  copyRangeToWorkbook: (input: CopyRangeInput) => Promise<void>;
  writeWorkbook: (workbook: WorkbookHandle, outputPath: string) => Promise<void>;
};

type WpsConverter = {
  detect: () => Promise<WpsDetectionResult>;
  convertXlsToXlsx: (inputPath: string, outputDirectory: string) => Promise<ConversionResult>;
};

type EtWorkbookReader = {
  openEtWorkbook: (inputPath: string) => Promise<WorkbookHandle>;
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
- `.xls` files must first pass through WPS conversion into a temp `.xlsx` file.
- `.et` files must go through the direct `.et` reader adapter; do not convert `.et` through WPS.
- The `.et` reader must preflight the file container signature and reject unknown/text-like files before accepting a SheetJS result. SheetJS may parse arbitrary text as a single-sheet workbook.
- Output files are always `.xlsx`.
- Temporary `.xls` conversion and processing files belong under a per-job temp workspace and must be cleaned after success, failure, or cancellation.
- Formula output uses cached calculated results. If a formula cell has no cached result, the feature must warn/skip rather than pretending it has a calculated display value.
- Selected-sheet object detection checks only the selected worksheet where possible. Non-selected sheets with object relationships do not block processing.

Environment/config contract:

- `OFFICETOOLS_WPS_COMMAND` may point the probe or production converter to an explicit WPS executable.
- Without an explicit env value, detect common WPS commands/paths on the target UOS ARM64 machine.

### 4. Validation & Error Matrix

| Condition | Expected Behavior |
| --- | --- |
| WPS command not found for `.xls` | Return a typed failure that tells the user to manually convert to `.xlsx`; batch jobs skip the current file and continue. |
| WPS `.xls` conversion exits without an `.xlsx` output | Treat as conversion failure; delete partial temp files. |
| Direct `.et` reader cannot open workbook | Return a typed failure that tells the user to manually convert to `.xlsx`; batch jobs skip the current file and continue. |
| `.et` file has an unknown/text-like container signature | Reject before SheetJS generic text fallback; tell the user to manually convert to `.xlsx`. |
| Direct `.et` reader lacks required metadata in validation samples | Narrow the `.et` support contract before split/merge implementation proceeds. |
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
- Good: representative `.et` samples expose sheet names, display rows, merge metadata, format metadata, and hidden row/column metadata through the direct reader.
- Bad: a text file renamed to `.et` is rejected by container preflight instead of being accepted as a one-cell SheetJS workbook.
- Bad: `.xls` is selected on a machine without WPS; the app asks the user to manually convert and skips that file.
- Bad: `.et` direct reading fails; the app asks the user to manually convert to `.xlsx` and skips that file.

### 6. Tests Required

Before implementing split/merge on top of these adapters, run:

```bash
pnpm probe:excel
```

On UOS ARM64 with WPS and representative `.xls` / `.et` samples, run:

```bash
pnpm probe:excel -- --run-wps-conversion
```

The flag attempts WPS `.xls` conversion. SheetJS `.et` direct-read validation runs whenever `.et` samples are present.

Assertions to preserve in automated or manual checks:

- style, fill, font, number/date format, column width, row height, merged cells, and hidden state survive output generation;
- cached formula result is used instead of formula text;
- missing formula result is surfaced as a limitation;
- selected-sheet object relationship blocks the file;
- WPS conversion produces a real `.xlsx` output for `.xls`, or the fallback is documented before split/merge implementation proceeds.
- SheetJS direct reading opens representative `.et` samples and exposes required metadata, or the `.et` support contract is narrowed before split/merge implementation proceeds.
- Malformed/text-like `.et` inputs are rejected before SheetJS generic text fallback can turn them into single-sheet workbooks.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Renderer receives a real path and opens workbook-like data itself.
await window.someFileApi.read('/home/user/source.xls');

// ET is routed through WPS conversion even though the plan requires direct reading.
await wpsConverter.convertXlsToXlsx('/home/user/source.et', tempDir);

// A SheetJS read result is accepted without checking whether the input was a workbook container.
const workbook = await etWorkbookReader.openEtWorkbook('/home/user/not-really.et');

// Formula without cached result is treated as a display value.
outputCell.value = formulaCell.value.formula;
```

#### Correct

```typescript
// Renderer stores sourceId; main process resolves the real path and runs adapters.
const sourcePath = getRegisteredFilePath(sourceId);
const workbook = sourcePath.endsWith('.et')
  ? await etWorkbookReader.openEtWorkbookAfterContainerPreflight(sourcePath)
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
