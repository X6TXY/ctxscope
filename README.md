# ctxscope

Set up and maintain correct instructions for AI coding agents.

`ctxscope` generates, checks, fixes, and compares the context files used by
Claude Code, Codex, Cursor, OpenCode, GitHub Copilot, Gemini CLI and Windsurf.

It answers the questions every agent-heavy repo eventually has:

- What context files exist?
- How much context do they add?
- Which agent is each file probably for?
- Which files are suspiciously large, stale, duplicated, or wrong?
- Which context problems should fail CI?
- Which problems can be fixed safely right now?
- How has context changed between refs?

## Install

Run without installing:

```bash
npx @x6txy/ctxscope init --agent claude
```

Or install globally:

```bash
npm install -g @x6txy/ctxscope
ctxscope doctor --changed
```

## Usage

```bash
ctxscope --help
ctxscope --version
  ctxscope init [--config|--agent <agent>]
  ctxscope scan [path]
  ctxscope scan --agent <all|codex|opencode|claude|generic>
  ctxscope scan --json
  ctxscope doctor [path] [--changed] [--diff <base>]
  ctxscope doctor --ci
  ctxscope doctor --json
  ctxscope fix [path]
  ctxscope fix --dry-run
  ctxscope fix --json
  ctxscope explain <code>
  ctxscope generate --agent <agent>
  ctxscope top
  ctxscope cost
```

Examples:

```bash
ctxscope init --agent claude
ctxscope doctor --changed
ctxscope fix --dry-run
ctxscope fix
ctxscope doctor --diff main
ctxscope explain CTX102
ctxscope top
ctxscope cost
```

## Output

```text
ctxscope doctor

Agent   all
Target  /repo
Status  fail

Agent Context Score  64/100
  Correctness  56
  Freshness    90
  Efficiency   76
  Consistency  78
  Coverage     100

Summary
  4 files, ~9,200 tokens, 2 errors, 3 warnings
  Run ctxscope fix to apply 1 safe fix.

Errors (2)
ERROR CTX101  AGENTS.md:18
  conflicting package managers: npm, pnpm
  Fix: Normalize package manager commands

ERROR CTX102  AGENTS.md:24
  references missing package script: test:e2e
  Recommendation: remove the command or replace it with an existing package.json script
```

`ctxscope fix` applies only deterministic safe fixes:

```text
ctxscope fix

Target  /repo
Mode    write

Summary
  Agent Context Score  64 -> 82
  Applied 1 safe fix
  Skipped 1 fix
  Saved ~420 tokens per session

Applied (1)
CTX101  AGENTS.md
  Normalize package manager commands to pnpm
```

## Supported Agents

v0.1 uses pattern-based discovery. It does not claim perfect runtime tracing for every agent.

| Agent | Files detected |
| --- | --- |
| Codex | `AGENTS.md`, `**/AGENTS.md` |
| OpenCode | `AGENTS.md`, `**/AGENTS.md`, `.opencode/**/*.md`, `.opencode/skills/**/SKILL.md` |
| Claude Code | `CLAUDE.md`, `**/CLAUDE.md`, `AGENTS.md` |
| Generic | `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, `**/SKILL.md`, `.cursor/rules/**`, `.github/copilot-instructions.md` |

Ignored directories:

- `.git`
- `node_modules`
- `dist`

## Warning Codes

`ctxscope scan` reports objective hygiene diagnostics. `ctxscope doctor` adds CI-ready error rules.

| Code | Meaning |
| --- | --- |
| `CTX001` | Oversized context file |
| `CTX002` | Duplicate heading across context files |
| `CTX003` | Stale relative markdown link |
| `CTX004` | Empty context file |
| `CTX005` | TODO, FIXME, or obsolete marker |
| `CTX006` | Repeated paragraph |
| `CTX101` | Conflicting package manager instructions |
| `CTX102` | Missing package script referenced by context |
| `CTX105` | Total context budget exceeded |

## Doctor

Use `doctor` when you want lint-style checks and CI exit codes:

```bash
ctxscope doctor
ctxscope doctor --ci
ctxscope doctor --json
```

`--ci` exits with code `1` when any diagnostic has severity `error`.

`doctor` also reports Agent Context Score, line numbers, safe fix hints, and recommendations.

Example output:

```text
ctxscope doctor

Agent   all
Target  /repo
Status  fail

Summary
  4 files, ~9,200 tokens, 2 errors, 1 warnings
  Run ctxscope fix to apply 1 safe fix.

Errors (2)
ERROR CTX101  AGENTS.md:18
  conflicting package managers: npm, pnpm
  Fix: Normalize package manager commands

ERROR CTX102  AGENTS.md:24
  references missing package script: test:e2e
  Recommendation: remove the command or replace it with an existing package.json script
```

## Fix

Use `fix` to apply deterministic repairs:

```bash
ctxscope fix --dry-run
ctxscope fix
ctxscope fix --json
```

Safe v0.3 autofixes:

- Normalize package manager command prefixes when exactly one lockfile identifies the repo package manager.
- Remove exact duplicate paragraphs after the first occurrence.

Recommendation-only in v0.3:

- `CTX102` missing package script references are not autofixed because replacing commands can break workflows.

## Config

Create a default config:

```bash
ctxscope init
```

This writes `ctxscope.config.json`:

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

Rule severities can be:

- `off`
- `warn`
- `error`

## CI

GitHub Actions example:

```yaml
- name: Check agent context
  run: npx @x6txy/ctxscope doctor --ci
```

## JSON Output

Use `--json` for automation:

```bash
ctxscope scan --json
ctxscope doctor --json
```

Shape:

```json
{
  "agent": "all",
  "target": ".",
  "files": [],
  "totalTokens": 0,
  "warnings": []
}
```

## Limitations

- Token counts are estimates: `ceil(character_count / 4)`.
- ctxscope is discovery-based, not real session tracing.
- Semantic checks are intentionally conservative. They inspect explicit commands and context text, not model behavior.
- `trace`, GitHub Actions, AI fixes, and dashboards are future work.

## License

MIT
