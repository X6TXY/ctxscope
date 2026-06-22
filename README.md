# ctxscope

Inspect and lint coding-agent context files.

`ctxscope` helps you see and lint the instructions your coding agents may read before they start working: `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, OpenCode skills, Cursor rules, and GitHub Copilot instructions.

It answers the first questions every agent-heavy repo eventually has:

- What context files exist?
- How much context do they add?
- Which agent is each file probably for?
- Which files are suspiciously large, empty, duplicated, or stale?
- Which context problems should fail CI?

## Install

Run without installing:

```bash
npx @x6txy/ctxscope scan
```

Or install globally:

```bash
npm install -g @x6txy/ctxscope
ctxscope scan
```

## Usage

```bash
ctxscope --help
ctxscope --version
ctxscope init
ctxscope scan [path]
ctxscope scan --agent <all|codex|opencode|claude|generic>
ctxscope scan --json
ctxscope doctor [path]
ctxscope doctor --ci
ctxscope doctor --json
```

Examples:

```bash
ctxscope scan
ctxscope scan apps/web
ctxscope scan --agent codex
ctxscope scan --agent opencode --json
ctxscope init
ctxscope doctor --ci
```

## Output

```text
ctxscope scan

Agent   all
Target  /repo

Files (3)
Path                               Tokens  Agents
.opencode/skills/backend/SKILL.md      ~6  opencode, generic
AGENTS.md                             ~13  codex, opencode, claude, generic
src/AGENTS.md                          ~3  codex, opencode, claude, generic

Summary
  3 files, ~22 tokens, 4 warnings

Warnings (4)
WARN CTX002  AGENTS.md
  heading "testing" appears in 2 context files
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

Example output:

```text
ctxscope doctor

Agent   all
Target  /repo
Status  fail

Summary
  4 files, ~9,200 tokens, 2 errors, 1 warnings

Errors (2)
ERROR CTX101  AGENTS.md
  conflicting package managers: npm, pnpm

ERROR CTX102  AGENTS.md
  references missing package script: test:e2e
```

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
- v0.2 is discovery-based, not real session tracing.
- Semantic checks are intentionally conservative. They inspect explicit commands and context text, not model behavior.
- `diff` and `trace` are future commands.

## License

MIT
