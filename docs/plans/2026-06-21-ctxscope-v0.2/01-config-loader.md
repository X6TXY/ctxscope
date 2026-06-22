# Task 01: Config Loader

## What To Build

Add a typed config loader for `ctxscope.config.json` with safe defaults and validation.

## Acceptance Criteria

- Loads `ctxscope.config.json` from the current working directory when present.
- Uses defaults when the file is missing.
- Supports `maxTokens`, `maxFileTokens`, `ignore`, and `rules`.
- Validates rule severities as `off`, `warn`, or `error`.
- Invalid config exits with a useful error once wired into CLI.
- Build succeeds with `pnpm build`.

## Files To Modify

- `src/config.ts`
- `src/types.ts`
- `src/cli.ts` if needed for early validation.

## Dependencies

- v0.1 scanner.
