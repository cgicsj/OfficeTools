# Excel Split Design

## Components

- Split tab UI plugs into platform file list, logs, progress, and cancellation controls.
- Split parser reads workbook metadata and field-name candidates.
- Split planner groups rows by selected-column display value and validates the 500-output limit.
- Split writer creates one `.xlsx` per group.
- Zip writer creates the final combined archive.

## Data Model

Per input file:

- original path;
- normalized processing path;
- display name;
- status;
- selected sheet;
- field-name row index;
- title area row range;
- available split columns;
- selected split column;
- output groups;
- errors/warnings.

## Output Strategy

For each output group:

- create a new workbook;
- copy the selected source sheet's relevant structure;
- copy title area rows;
- copy data rows belonging to the group;
- preserve required style and layout attributes;
- write calculated display values instead of formulas;
- name file with sanitized split value.

After all files complete, zip every file folder into a single result archive.

## Failure Handling

File-level failures mark the file as skipped or failed and continue the batch unless the user cancels. Cancellation stops the whole batch.
