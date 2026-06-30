# UOS ARM64 Deb Packaging And Integration Design

## Packaging

Use the packaging tool selected by the Electron scaffold, configured to emit an ARM64 `.deb` artifact. The app should not bundle WPS. It must call the system installation through the same adapter used in development.

## Runtime Paths

Validate packaged behavior for:

- app cache/temp directory;
- system Downloads directory;
- user-selected output directories;
- WPS executable detection;
- sample file access through system dialogs.

## Integration Scope

This child validates the full installed app rather than adding new feature behavior. Any feature regression should go back to the owning child task.
