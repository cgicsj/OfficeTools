# Project Pitfalls and Big Questions

This directory is reserved for OfficeTools-specific pitfalls discovered from real implementation or debugging work.

There are no project-specific big-question notes yet after the spec bootstrap refresh. Add a new file here only when a recurring or high-impact issue has source evidence from this repository.

## When to Add a Note

Add a note when one of these is true:

- A bug took significant debugging and should not be rediscovered.
- A package/build/platform behavior surprised the implementation.
- A cross-layer contract is easy to break despite existing specs.
- A future task needs a focused warning that does not belong to only backend, frontend, or shared docs.

## Note Shape

Use this shape for new files:

```markdown
# Short Pitfall Name

## Applies When

## Symptom

## Root Cause

## OfficeTools Source Evidence

## Correct Pattern

## Verification
```

Link the new file from this index after adding it.
