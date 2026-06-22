# ctxscope

**Keep AI coding agents in sync with your repository.**

Your code changes. Agent instructions often do not.

`ctxscope` generates, checks, fixes, and compares the context files used by
Claude Code, Codex, Cursor, OpenCode, GitHub Copilot, Gemini CLI, and Windsurf.

It catches stale commands, conflicting instructions, missing scripts, duplicated
context, and unnecessary token usage before they confuse your agents or break CI.

```bash
npx @x6txy/ctxscope doctor
```

```text
Agent Context Score  64/100

ERROR CTX101  AGENTS.md:18
  conflicting package managers: npm, pnpm
  Fix: Normalize package manager commands

ERROR CTX102  AGENTS.md:24
  references missing package script: test:e2e
  Recommendation: remove or replace with an existing package.json script

WARN CTX006  CLAUDE.md:42
  contains a repeated paragraph
  Fix: Remove repeated paragraph

Run ctxscope fix to apply 1 safe fix.
```

## Why ctxscope?

Agent-heavy repositories accumulate instructions across multiple files:

```text
AGENTS.md
CLAUDE.md
.cursor/rules/*
.github/copilot-instructions.md
.opencode/skills/*/SKILL.md
```

As the repository evolves, these files become stale, inconsistent, and expensive.

`ctxscope` systematically answers:

- Which agent context files exist?
- Are their commands and file references still valid?
- Do different agents receive conflicting instructions?
- How much context is loaded per session?
- What changed compared with `main`?
- Which problems should block CI?
- Which problems can be fixed safely?

## Install

```bash
npx @x6txy/ctxscope doctor
```

Or install globally:

```bash
npm install -g @x6txy/ctxscope
ctxscope doctor --changed
```

## Quick start

### 1. Create or detect agent context

For a new repository:

```bash
npx @x6txy/ctxscope init --agent claude
```

For an existing repository:

```bash
npx @x6txy/ctxscope doctor
```

### 2. Preview safe fixes

```bash
npx @x6txy/ctxscope fix --dry-run
```

### 3. Apply deterministic fixes

```bash
npx @x6txy/ctxscope fix
```

```text
Target  /repo
Mode    write

Agent Context Score  64 -> 82
Applied 1 safe fix
Skipped 1 fix
Saved ~420 tokens per session
```

### 4. Check only relevant changes

```bash
npx @x6txy/ctxscope doctor --changed
```

### 5. Compare against the main branch

```bash
npx @x6txy/ctxscope doctor --diff main
```

```text
Context Diff

Score: 87 -> 74
Tokens: ~5,900 -> ~7,420 (+1,520)

New problems:
  ERROR CTX102 AGENTS.md:24
    references missing package script: test:e2e

Fixed problems:
  WARN CTX006 CLAUDE.md
    repeated paragraph removed
```

### 6. Protect pull requests

```yaml
- name: Check AI agent context
  run: npx @x6txy/ctxscope doctor --ci
```

## Generate

**Create a context file based on the repository's actual setup.**

```bash
ctxscope generate --agent claude
ctxscope generate --agent codex --force
ctxscope generate --agent cursor --dry-run
```

`ctxscope` detects repository facts: package manager, available scripts, source
directories, and common tooling. Generated content is deterministic and
conservative—review before committing.

Supported agents:

| Agent | Creates |
| --- | --- |
| `claude` | `CLAUDE.md` |
| `codex` | `AGENTS.md` |
| `opencode` | `AGENTS.md` |
| `cursor` | `.cursor/rules/ctxscope-generated.mdc` |
| `copilot` | `.github/copilot-instructions.md` |
| `gemini` | `GEMINI.md` |
| `windsurf` | `.windsurf/rules/ctxscope-generated.md` |

Existing files are not modified unless `--force` is provided.

## Doctor

**Validate correctness, measure health, and gate CI.**

```bash
  ctxscope doctor [path] [--agent <agent>] [--json] [--ci] [--verbose] [--changed] [--diff <base>]
```

- `doctor` runs all rules and reports diagnostics with scores.
- `--ci` exits with code `1` when any diagnostic has severity `error`.
- `--verbose` shows per-category score breakdown with individual deduction sources.
- `--changed` focuses diagnostics on the current working tree and shows repository facts delta.
- `--diff <base>` compares context health against a Git ref without checkout mutation.

```text
ctxscope doctor --ci

Agent Context Score  64/100
  Correctness  56
  Freshness    72
  Efficiency   68
  Consistency  78
  Coverage     100

Summary
  4 files, ~9,200 tokens, 2 errors, 3 warnings
  Run ctxscope fix to apply 1 safe fix.
```

## Fix

**Apply deterministic safe repairs.**

```bash
ctxscope fix [path] [--agent <agent>] [--dry-run] [--json]
```

Current safe autofixes:

- **Package manager normalization**: when exactly one lockfile identifies the
  package manager, commands in context files are normalized.
- **Duplicate paragraph removal**: exact repeated paragraphs after the first
  occurrence are removed.

Recommendation-only:

- `CTX102` missing package script references are not autofixed by default
  because replacing commands can break workflows.

`fix --dry-run` now shows a unified diff for each change:

```diff
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -16,4 +16,4 @@
-Run npm install.
-Run npm run test.
+Run pnpm install.
+Run pnpm test.
```

## Top

**Find the largest context sources.**

```bash
ctxscope top [path] [--agent <agent>]
```

```text
Largest Context Files

Path                               Tokens
------------------------------------------
AGENTS.md                          ~3,200
.cursor/rules/backend.mdc          ~2,100
CLAUDE.md                          ~1,740

Potential savings:
  repeated paragraphs             ~420
```

## Cost

**Estimate context overhead per session.**

```bash
ctxscope cost [path] [--agent <agent>]
```

```text
Context Overhead

  Current agent context:
    ~9,380 tokens

  Efficiency:
    budget: 8,000
    over budget: ~1,380
    repeated paragraph waste: ~420
```

Token counts are estimates and do not represent exact provider billing.

## Explain

**Understand any diagnostic without leaving the terminal.**

```bash
ctxscope explain CTX102
```

```text
CTX102: Missing package script

  Severity: ERROR
  Problem:  Agent instructions reference a package.json script that does not
            exist.
  Why:      Agents may attempt to run missing commands, wasting tokens and time.
  Fix:      Update the instruction to an existing script, or add the missing
            script to package.json.
  Autofix:  no (recommendation only)
```

## Scan

**Inventory discovered context files and hygiene warnings.**

```bash
ctxscope scan [path] [--agent <agent>] [--json]
```

```text
ctxscope scan

Agent   all
Target  /repo

Files (3)
Path                               Tokens  Agents
CLAUDE.md                             ~6  claude, generic
AGENTS.md                            ~13  codex, opencode, claude, generic
.opencode/skills/backend/SKILL.md     ~6  opencode, generic

Summary
  3 files, ~22 tokens, 4 warnings
```

Use `scan` to see what files exist and which agents they serve.
Use `doctor` for correctness validation, scoring, CI exit codes, and Git-aware
comparisons.

## Supported agents

| Agent | Status | Files detected |
| --- | --- | --- |
| Codex | Native | `AGENTS.md`, `**/AGENTS.md` |
| OpenCode | Native | `AGENTS.md`, `**/AGENTS.md`, `.opencode/**/*.md`, `.opencode/skills/**/SKILL.md` |
| Claude Code | Native | `CLAUDE.md`, `**/CLAUDE.md`, `AGENTS.md` |
| Cursor | Pattern-based | `.cursor/rules/**` |
| GitHub Copilot | Pattern-based | `.github/copilot-instructions.md` |
| Gemini CLI | Pattern-based | `GEMINI.md` (`generate` only) |
| Windsurf | Pattern-based | `.windsurf/rules/ctxscope-generated.md` (`generate` only) |
| Generic | Pattern-based | `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, `**/SKILL.md`, `.cursor/rules/**`, `.github/copilot-instructions.md` |

Ignored directories: `.git`, `node_modules`, `dist`.

## Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `CTX001` | warn | Oversized context file |
| `CTX002` | warn | Duplicate heading across context files |
| `CTX003` | warn | Stale relative markdown link |
| `CTX004` | warn | Empty context file |
| `CTX005` | warn | TODO, FIXME, or obsolete marker |
| `CTX006` | warn | Repeated paragraph (safe autofix) |
| `CTX101` | error | Conflicting package manager instructions (safe autofix) |
| `CTX102` | error | Missing package script referenced by context |
| `CTX103` | warn | Referenced repository path does not exist |
| `CTX104` | warn | Unrecognized command reference |
| `CTX105` | error | Total context budget exceeded |

## Configuration

```bash
ctxscope init
ctxscope init --config
```

Creates `ctxscope.config.json`:

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

Severity values: `off`, `warn`, `error`.

## CI

```yaml
- name: Check AI agent context
  run: npx @x6txy/ctxscope doctor --ci
```

Block pull requests that introduce unresolved context errors.

## JSON output

Use `--json` for automation:

```bash
ctxscope scan --json
ctxscope doctor --json
ctxscope fix --json
```

## Safety model

`ctxscope` is designed for trust over magic.

- All fixes are deterministic and computed from current files at apply time.
- No AI-generated edits or prose.
- `fix` does not modify files unless explicitly invoked.
- Missing script references are recommendations only.
- Generated instruction files are not overwritten without `--force`.
- `doctor --diff` never runs `git checkout` or mutates the working tree.

## Limitations

- Token counts are estimates: `ceil(character_count / 4)`.
- Discovery is pattern-based, not runtime session tracing.
- Semantic checks are conservative. They inspect explicit commands and context
  text, not model behavior.
- CTX103 (path detection) recognizes common source directory patterns but may
  miss unconventional path references.
- CTX104 (command detection) uses a built-in allowlist and may produce false
  positives for custom project-local tools.
- Gemini CLI and Windsurf detection is experimental and limited to `generate`.
- `trace`, cloud dashboard, and AI-powered fixes are future work.

## License

MIT
