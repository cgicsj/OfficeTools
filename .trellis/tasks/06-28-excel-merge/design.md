# Excel Merge Design

## Components

- Merge tab UI plugs into platform folder selection, file list, logs, progress, and cancellation controls.
- Folder scanner filters candidate files.
- Merge parser loads selected sheet metadata.
- Header comparator compares field-name row display values.
- One-sheet writer appends title/data ranges according to header comparison.
- Multi-sheet writer copies selected sheets into one workbook.

## Data Model

Per input file:

- original path;
- normalized processing path;
- display name;
- status;
- selected sheet;
- field-name row index for one-sheet mode;
- title area row range;
- header display values;
- errors/warnings.

Merge job:

- mode;
- selected files;
- output directory;
- output file name;
- collision policy;
- progress and cancellation token.

## One-Sheet Strategy

Use the first valid file as the output layout anchor. Its title area and column widths initialize the output sheet. If all later header rows match, append only their data rows. If any header differs, append that file's title area and data rows and show the required warning dialog.

## Multi-Sheet Strategy

Copy each selected sheet into the output workbook. Use sanitized source file names as sheet names, then apply Excel's 31-character limit and duplicate suffixing.
