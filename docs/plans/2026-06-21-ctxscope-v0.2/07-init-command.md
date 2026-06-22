# Task 07: Init Command

## What To Build

Add `ctxscope init` to write a default `ctxscope.config.json`.

## Acceptance Criteria

- Creates `ctxscope.config.json` if missing.
- Refuses to overwrite an existing config unless a future force flag is added.
- Output tells the user what was created.

## Files To Modify

- `src/init.ts`
- `src/cli.ts`

## Dependencies

- Task 01.
