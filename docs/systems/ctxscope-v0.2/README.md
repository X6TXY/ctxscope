# ctxscope v0.2 System

## Overview

`ctxscope` v0.2 turns the package from a scanner into a CI-ready linter for coding-agent context. It keeps the v0.1 `scan` behavior and adds config, diagnostics, `doctor`, `--ci`, and high-value error rules.

## Commands

```bash
ctxscope init
ctxscope scan [path] [--agent <all|codex|opencode|claude|generic>] [--json]
ctxscope doctor [path] [--agent <all|codex|opencode|claude|generic>] [--json] [--ci]
```

## Architecture

Core modules:

- `src/cli.ts`: command parsing and dispatch.
- `src/config.ts`: `ctxscope.config.json` defaults and validation.
- `src/init.ts`: writes the default config.
- `src/scan.ts`: context file discovery and token estimation orchestration.
- `src/warnings.ts`: CTX001-CTX006 hygiene diagnostics.
- `src/diagnostics.ts`: diagnostic creation, severity overrides, sorting.
- `src/doctor.ts`: linter orchestration and pass/fail summary.
- `src/rules/package-manager.ts`: CTX101 package manager conflict rule.
- `src/rules/package-scripts.ts`: CTX102 missing package script rule.
- `src/rules/budget.ts`: CTX105 total context budget rule.
- `src/output.ts`: human and JSON output.

Data flow:

```text
CLI
  -> loadConfig()
  -> scanContext()
  -> collect diagnostics
  -> doctor summary
  -> human output or JSON
  -> --ci exit code
```

## Config

`ctxscope init` creates:

```json
{
  "maxTokens": 8000,
  "maxFileTokens": 2500,
  "ignore": ["node_modules", "dist", ".git"],
  "rules": {
    "CTX001": "warn",
    "CTX002": "warn",
    "CTX003": "warn",
    "CTX004": "warn",
    "CTX005": "warn",
    "CTX006": "warn",
    "CTX101": "error",
    "CTX102": "error",
    "CTX105": "error"
  }
}
```

Supported rule severities:

- `off`
- `warn`
- `error`

## Diagnostics

v0.2 diagnostics:

| Code | Meaning | Default |
| --- | --- | --- |
| `CTX001` | File exceeds `maxFileTokens` | `warn` |
| `CTX002` | Duplicate heading across context files | `warn` |
| `CTX003` | Stale relative markdown link | `warn` |
| `CTX004` | Empty context file | `warn` |
| `CTX005` | TODO, FIXME, or obsolete marker | `warn` |
| `CTX006` | Repeated paragraph | `warn` |
| `CTX101` | Conflicting package manager instructions | `error` |
| `CTX102` | Missing package script referenced by context | `error` |
| `CTX105` | Total context exceeds `maxTokens` | `error` |

## CI Behavior

`ctxscope doctor --ci` exits:

- `0` when there are no error diagnostics.
- `1` when any diagnostic has severity `error`.

## JSON Output

`scan --json` preserves the v0.1 shape with `warnings` for compatibility.

`doctor --json` emits:

```json
{
  "agent": "all",
  "target": ".",
  "status": "pass",
  "summary": {
    "files": 0,
    "totalTokens": 0,
    "warnings": 0,
    "errors": 0
  },
  "files": [],
  "diagnostics": []
}
```

## Release Checks

Verified for v0.2:

```bash
pnpm build
node dist/cli.js --version
node dist/cli.js --help
node dist/cli.js doctor --json
npm pack --dry-run
```

`npm pack --dry-run` includes only package artifacts:

- `CHANGELOG.md`
- `LICENSE`
- `README.md`
- `dist/cli.js`
- `package.json`

## Limitations

- Config is loaded from the current working directory only.
- `ignore` is parsed but not yet applied to file traversal.
- Script detection is conservative and command-pattern based.
- No `diff` or `trace` command yet.
