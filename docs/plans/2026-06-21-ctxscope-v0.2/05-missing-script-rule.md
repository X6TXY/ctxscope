# Task 05: Missing Script Rule

## What To Build

Add CTX102 for context instructions that reference missing package scripts.

## Acceptance Criteria

- Parses root `package.json` scripts.
- Detects `npm run <script>`, `pnpm <script>`, `yarn <script>`, and `bun run <script>`.
- Reports missing scripts as `CTX102`.
- Default severity is `error`.

## Files To Modify

- `src/rules/package-scripts.ts`
- `src/diagnostics.ts`

## Dependencies

- Task 03.
