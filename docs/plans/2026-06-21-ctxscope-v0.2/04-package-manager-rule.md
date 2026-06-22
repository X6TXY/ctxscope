# Task 04: Package Manager Conflict Rule

## What To Build

Add CTX101 for conflicting package manager instructions.

## Acceptance Criteria

- Detects mentions of npm, pnpm, yarn, and bun commands in context files.
- Reports `CTX101` when multiple package managers are instructed.
- Default severity is `error`.

## Files To Modify

- `src/rules/package-manager.ts`
- `src/diagnostics.ts`

## Dependencies

- Task 03.
