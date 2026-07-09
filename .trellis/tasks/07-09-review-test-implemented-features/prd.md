# Review and test implemented features

## Goal

Review the current uncommitted implementation changes and functionally test the implemented speech-model related features before handoff.

## Requirements

- Inspect all current uncommitted code/config/resource changes in the repository.
- Verify the implementation against the apparent product requirements and existing project conventions.
- Run focused and project-level validation commands that are available locally.
- Manually exercise the implemented desktop functionality where feasible, especially speech model discovery/download and related renderer workflow behavior.
- Record any defects, risks, or validation blockers with file-level pointers and reproduction details.

## Acceptance Criteria

- [ ] Changed files are reviewed for correctness, data flow, error handling, and UI behavior.
- [ ] Applicable Trellis specs are consulted for frontend, backend/main-process, and shared cross-layer behavior.
- [ ] Lint/type-check/build or equivalent validation commands are run, or blockers are explicitly documented.
- [ ] Implemented functionality is functionally tested as far as the local environment allows.
- [ ] Final report clearly states pass/fail status, issues found, commands run, and recommended next actions.

## Out of Scope

- Implementing unrelated product changes.
- Committing changes unless explicitly requested.
- Rewriting existing implementation unless review uncovers a blocking defect that must be fixed before validation can continue.
