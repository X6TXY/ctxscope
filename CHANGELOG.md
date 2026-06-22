# Changelog

## 0.2.0 - 2026-06-21

### Added

- Added `ctxscope init` to create `ctxscope.config.json`.
- Added configurable `maxTokens`, `maxFileTokens`, `ignore`, and rule severities.
- Added diagnostics model with `off`, `warn`, and `error` severities.
- Added `ctxscope doctor` for lint-style context checks.
- Added `ctxscope doctor --ci` with exit code `1` on error diagnostics.
- Added `ctxscope doctor --json` with stable automation output.
- Added `CTX101` for conflicting package manager instructions.
- Added `CTX102` for package scripts referenced in context but missing from `package.json`.
- Added `CTX105` for total context budget violations.

### Changed

- `CTX001` now respects `maxFileTokens` from config.
- Human output now uses diagnostic wording for mixed warnings and errors.

## 0.1.0 - 2026-06-21

Published as `@x6txy/ctxscope` on npm. The installed binary is still `ctxscope`.

### Added

- Added `ctxscope scan [path]` CLI command.
- Added agent filters for `all`, `codex`, `opencode`, `claude`, and `generic`.
- Added context file discovery for common coding-agent instruction surfaces.
- Added token estimates for discovered context files.
- Added warning codes `CTX001` through `CTX006` for safe context hygiene checks.
- Added human-readable terminal output with aligned columns and color support.
- Added stable JSON output via `--json`.
- Added README, MIT license, and npm package metadata.
