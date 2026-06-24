# Changelog

## 0.6.0 - 2026-06-22

### Added

- Added `ctxscope optimize` command — consolidates agent skill files into lightweight category pointers (SkillPointer pattern). Reduces startup token cost from skill descriptions by ~90%.
- Added `CTX106` — detects skill description token overhead when too many skills are loaded at startup. Warns at >1,000 tokens, errors at >5,000 tokens.
- Added heuristic categorization engine (35 categories) for automatic skill classification.
- Added `--target`, `--vault`, `--dry-run`, `--undo` flags to `optimize` command.
- Added `--skills` flag to `doctor` for focused skill bloat reporting.

### Changed

- Updated `ctxscope doctor` to include CTX106 skill bloat diagnostic in the `correctness` score category.
- Updated shell completions (zsh, bash, fish) with `optimize` subcommand and flags.

## 0.5.1 - 2026-06-22

### Changed

- CTX104 now filters false-positive command detections — skips common English words, CLI flags, dotted identifiers, single-character words, backtick-wrapped references, quoted strings, and shell redirect/pipes.
- Backtick-wrapped references in `run/use/execute` command capture (`\`cmd\``) are now correctly stripped before command matching.

## 0.5.0 - 2026-06-22

### Changed

- Rewrote README.md with proper structure: problem-first, scan/doctor/fix/generate/top/cost/explain separation, quick start workflow, agent status table, CI workflow, safety model.

### Added

- Added `CTX103` — detects referenced paths in agent instructions that do not exist in the repository, with similar path suggestions.
- Added `CTX104` — detects command references that are not recognized as known tools or available scripts.
- Added `--verbose` flag to `doctor` for detailed score breakdown (shows per-category deductions).
- Added `completion` command for zsh, bash, and fish shell completions.
- Added unified diff display in `fix --dry-run` output (shows actual before/after changes).
- Added `--changed` context diff with repository facts comparison (scripts, tools, directories).
- Added `repo-facts-diff` module for comparing repository states across refs.

### Changed

- Doctor score categories now include CTX103 and CTX104 under `correctness`.
- `fix` result includes machine-readable diffs for each applied edit.
- `doctor --changed` now shows repository facts delta alongside diagnostics.

## 0.4.1 - 2026-06-22

### Changed

- Minor README refinements.

## 0.4.0 - 2026-06-22

### Added

- Added `ctxscope init --agent <agent>` and `ctxscope init --config`.
- Added `ctxscope generate --agent <agent>` for deterministic agent instruction setup (Claude Code, Codex, OpenCode, Cursor, Copilot, Gemini CLI, Windsurf).
- Added `ctxscope explain CTXxxx` for in-cli diagnostic documentation.
- Added `ctxscope top` and `ctxscope cost` for context overhead visibility.
- Added `ctxscope doctor --changed` for working tree context impact.
- Added `ctxscope doctor --diff <base>` for non-mutating context regression comparison.
- Added Agent Context Score to `ctxscope doctor`.
- Added diagnostic line and column metadata where rules can locate the issue.
- Added recommendations and safe fix metadata to diagnostics.
- Added `ctxscope fix` with `--dry-run`, `--json`, and `--agent` support.
- Added deterministic package manager normalization for context files when exactly one lockfile identifies the package manager.
- Added exact duplicate paragraph removal.
- Added `node:test` coverage for doctor metadata, scoring, fix behavior, repo facts, generate, and explain.

### Changed

- Repositioned README around CLI-first agent context lifecycle.
- `CTX102` missing script references are recommendation-only and are not autofixed by default.

### Removed

- Removed `init` strict argument rejection in favor of subcommand dispatch.

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
