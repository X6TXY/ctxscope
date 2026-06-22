# ctxscope v0.3 System

## Overview

`ctxscope` v0.3 turns the package from a diagnostic-only linter into a deterministic repair tool for AI-agent repository instructions.

Release promise:

> Stop AI agents from following stale repo instructions.

Primary workflow:

```bash
ctxscope doctor
ctxscope fix --dry-run
ctxscope fix
ctxscope doctor
```

## Commands

```bash
ctxscope init
ctxscope scan [path] [--agent <all|codex|opencode|claude|generic>] [--json]
ctxscope doctor [path] [--agent <all|codex|opencode|claude|generic>] [--json] [--ci]
ctxscope fix [path] [--agent <all|codex|opencode|claude|generic>] [--dry-run] [--json]
```

## Architecture

Core modules:

- `src/cli.ts`: command parsing and dispatch for `scan`, `doctor`, `fix`, and `init`.
- `src/scan.ts`: context file discovery and token estimation orchestration.
- `src/warnings.ts`: CTX001-CTX006 hygiene diagnostics with line metadata where available.
- `src/diagnostics.ts`: diagnostic creation, severity overrides, optional recommendations, and fix metadata.
- `src/locations.ts`: line and column utilities for regex and offset-based diagnostics.
- `src/doctor.ts`: linter orchestration, summary, and score attachment.
- `src/score.ts`: deterministic Agent Context Score calculation.
- `src/fix.ts`: deterministic dry-run/write fix engine and safe fixers.
- `src/rules/package-manager.ts`: CTX101 and package manager lockfile detection.
- `src/rules/package-scripts.ts`: CTX102 missing script diagnostics and recommendations.
- `src/rules/budget.ts`: CTX105 total context budget diagnostics.
- `src/output.ts`: human and JSON formatting for scan, doctor, and fix.

Data flow:

```text
CLI
  -> loadConfig()
  -> scanContext()
  -> doctor rules + hygiene diagnostics
  -> Agent Context Score
  -> human output or JSON

ctxscope fix
  -> run doctor before
  -> recompute safe deterministic edits
  -> optionally write files
  -> run doctor after
  -> report applied, skipped, score, and token delta
```

## Diagnostic Model

Diagnostics now support optional location, recommendation, and fix metadata:

```ts
export type Diagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  path: string;
  message: string;
  line?: number;
  column?: number;
  recommendation?: string;
  fix?: DiagnosticFix;
};
```

Fix metadata is descriptive only. `ctxscope fix` recomputes edits from current files instead of applying serialized patches.

## Agent Context Score

`ctxscope doctor` reports an overall score plus category scores:

- Correctness: CTX101, CTX102.
- Freshness: CTX003, CTX005.
- Efficiency: CTX001, CTX006, CTX105.
- Consistency: CTX002, CTX101.
- Coverage: context discovery baseline.

The score is deterministic and weighs errors more heavily than warnings. Budget pressure and duplicate paragraphs reduce efficiency.

## Safe Fixes

v0.3 applies only deterministic low-risk fixes.

Safe autofixes:

- Package manager normalization in context files when exactly one lockfile identifies the package manager.
- Exact duplicate paragraph removal after the first occurrence.

Recommendation-only behavior:

- CTX102 missing package script references are not autofixed by default because replacing commands can break workflows.

## Output Behavior

`ctxscope doctor` now includes:

- Agent Context Score.
- `file:line` diagnostic locations where available.
- `Fix:` lines for safe fixes.
- `Recommendation:` lines for non-autofixable guidance.
- Safe fix count in the summary.

`ctxscope fix` includes:

- Dry-run or write mode.
- Applied safe fixes.
- Skipped fixes with reasons.
- Before and after doctor results in JSON mode.
- Score and token deltas in human mode.

## Tests

v0.3 adds `node:test` coverage compiled through `tsup`:

```bash
pnpm test
```

Covered behavior:

- Doctor diagnostic line metadata and recommendations.
- Score penalties for errors, warnings, budget pressure, and duplication.
- Dry-run does not write files.
- Package manager normalization writes expected commands.
- Duplicate paragraph removal is idempotent.
- CTX102 is skipped and left unchanged.

## Release Checks

Verified for v0.3 implementation:

```bash
pnpm build
pnpm test
```

## Limitations

- Package manager normalization is intentionally syntax-based and only edits context files.
- CTX102 remains recommendation-only.
- No `trace` command, GitHub Action, AI fixes, web dashboard, large generate flow, or semantic markdown analysis.
