# Task 03: Doctor Command

## What To Build

Add `ctxscope doctor` as the lint command.

## Acceptance Criteria

- Supports `ctxscope doctor [path]`.
- Supports `ctxscope doctor --json`.
- Supports `ctxscope doctor --ci`.
- `--ci` exits `1` when diagnostics include `error`.
- Human output groups errors and warnings.

## Files To Modify

- `src/cli.ts`
- `src/doctor.ts`
- `src/output.ts`

## Dependencies

- Task 02.
