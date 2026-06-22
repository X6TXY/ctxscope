# Task 06: Context Budget Rule

## What To Build

Add CTX105 for total context budget violations.

## Acceptance Criteria

- Reports `CTX105` when total tokens exceed `maxTokens`.
- Default severity is `error`.
- Existing CTX001 respects `maxFileTokens`.

## Files To Modify

- `src/rules/budget.ts`
- `src/diagnostics.ts`

## Dependencies

- Task 03.
