# ctxscope

Inspect and lint coding-agent context files.

`ctxscope` helps you see the instructions your coding agents may read before they start working: `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, OpenCode skills, Cursor rules, and GitHub Copilot instructions.

It answers the first questions every agent-heavy repo eventually has:

- What context files exist?
- How much context do they add?
- Which agent is each file probably for?
- Which files are suspiciously large, empty, duplicated, or stale?

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
ctxscope scan [path]
ctxscope scan --agent <all|codex|opencode|claude|generic>
ctxscope scan --json
```

Examples:

```bash
ctxscope scan
ctxscope scan apps/web
ctxscope scan --agent codex
ctxscope scan --agent opencode --json
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

`ctxscope scan` reports objective hygiene warnings only.

| Code | Meaning |
| --- | --- |
| `CTX001` | Oversized context file |
| `CTX002` | Duplicate heading across context files |
| `CTX003` | Stale relative markdown link |
| `CTX004` | Empty context file |
| `CTX005` | TODO, FIXME, or obsolete marker |
| `CTX006` | Repeated paragraph |

## JSON Output

Use `--json` for automation:

```bash
ctxscope scan --json
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
- v0.1 is discovery-based, not real session tracing.
- Semantic conflicts are not detected yet. For example, `npm` vs `pnpm` policy conflicts are planned for a future `doctor` command.
- `diff` and `trace` are future commands.

## License

MIT
