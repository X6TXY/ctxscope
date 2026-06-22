# Task 02: Diagnostics Model

## What To Build

Replace warning-only language with a diagnostics model that supports `warn` and `error`.

## Acceptance Criteria

- Introduces `Diagnostic` type.
- Existing CTX001-CTX006 still work.
- Severity can be overridden by config.
- Rules can be disabled with `off`.

## Files To Modify

- `src/types.ts`
- `src/warnings.ts`
- `src/diagnostics.ts`

## Dependencies

- Task 01.
