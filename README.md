<div align="center">
  <img src="assets/ctxscope-architecture.svg" alt="ctxscope Architecture" width="100%">

  # ctxscope <img src="assets/ctxscope-logo.svg" width="36" height="36" align="center" alt="ctxscope">

  **Keep AI coding agents in sync with your repository.**

  [![npm version](https://img.shields.io/npm/v/@x6txy/ctxscope?color=059669&label=%40x6txy%2Fctxscope)](https://www.npmjs.com/package/@x6txy/ctxscope)
  ![Node >=20](https://img.shields.io/badge/node-%3E%3D20-059669)
  [![License: MIT](https://img.shields.io/badge/License-MIT-6366f1.svg)](https://opensource.org/licenses/MIT)
  [![OpenCode Compatible](https://img.shields.io/badge/OpenCode-compatible-059669.svg)](https://opencode.ai)
  [![Claude Code Compatible](https://img.shields.io/badge/Claude%20Code-compatible-059669.svg)](https://docs.anthropic.com/en/docs/claude-code)
  [![Codex Compatible](https://img.shields.io/badge/Codex-compatible-6366f1.svg)](https://github.com/openai/codex)
  [![Cursor Compatible](https://img.shields.io/badge/Cursor-compatible-6366f1.svg)](https://cursor.sh)
</div>

<br/>

Your code changes. Agent instructions often do not.

`ctxscope` is a local, deterministic CLI for the context files used by Claude Code, Codex, Cursor, OpenCode, GitHub Copilot, Gemini CLI, and Windsurf. It generates, checks, fixes, scores, and compares agent instructions without AI-generated rewrites.

```bash
npx @x6txy/ctxscope diagnose
```

```
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

---

## <img src="assets/ctxscope-logo.svg" width="24" height="24" align="center" alt=""> Why

Agent-heavy repositories accumulate instructions across multiple files:

```text
AGENTS.md
CLAUDE.md
.cursor/rules/*
.github/copilot-instructions.md
.opencode/skills/*/SKILL.md
```

As the repository evolves, those files become stale, inconsistent, duplicated, and expensive. The result is context drift: agents receive outdated commands, broken paths, conflicting package-manager instructions, or too much low-value text.

`ctxscope` answers the practical questions:

- Which agent context files exist?
- Are their commands and file references still valid?
- Do different files conflict?
- How much context is loaded?
- Which safe fixes can be previewed and applied?
- What changed compared with `main`?

<div align="center">
  <img src="assets/ctxscope-comparison.svg" alt="ctxscope Before vs After Comparison" width="100%">
</div>

---

## <img src="assets/ctxscope-logo.svg" width="24" height="24" align="center" alt=""> Workflow

Generate -> Diagnose -> Preview fixes -> Apply -> Compare.

### 1. Generate or discover context

```bash
npx @x6txy/ctxscope generate --agent claude
```

For an existing repository:

```bash
npx @x6txy/ctxscope diagnose
```

### 2. Diagnose with score details

```bash
npx @x6txy/ctxscope diagnose --verbose
```

```text
Agent Context Score  64/100
  Correctness  56/100
    -22  CTX102  references missing package script: test:e2e
    -10  CTX103  Referenced path does not exist: apps/api
  Freshness    100/100
  Efficiency   76/100
    -10  CTX006  contains a repeated paragraph
    -8   duplication  repeated paragraph pressure
  Consistency  78/100
    -22  CTX101  conflicting package manager instructions
  Coverage     100/100
```

### 3. Preview safe fixes

```bash
npx @x6txy/ctxscope fix --dry-run
```

```diff
Diff  AGENTS.md
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1,4 +1,4 @@
 # Instructions

-Run npm install and npm run test.
+Run pnpm install and pnpm test.
```

### 4. Apply deterministic fixes

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

### 5. Compare context drift

```bash
npx @x6txy/ctxscope diagnose --diff main
```

```text
Context Diff

Score: 87 -> 74 (-13)
Tokens: ~5,900 -> ~7,420 (+1,520)

New problems:
  ERROR CTX102 AGENTS.md:24
    references missing package script: test:e2e

Fixed problems:
  WARN CTX006 CLAUDE.md
    repeated paragraph removed
```

---

## <img src="assets/ctxscope-logo.svg" width="24" height="24" align="center" alt=""> Commands

| Command | Description |
|---|---|
| `scan [path]` | Inventory discovered context files and hygiene warnings |
| `diagnose [path]` | Validate context files and score repository health |
| `fix [path]` | Preview or apply deterministic safe repairs |
| `generate [path]` | Create context files based on repository facts |
| `init [path]` | Create config file or agent context |
| `largest [path]` | Find the largest context sources |
| `tokens [path]` | Estimate context overhead per session |
| `explain <code>` | Understand any diagnostic without leaving the terminal |
| `skills categories` | Generate a skill category map |
| `skills optimize` | Consolidate skills into lightweight pointers |

Useful options: `--agent <agent>`, `--json`, `--verbose`, `--changed`, `--diff <ref>`, `--dry-run`, `--ci`.

Run any command with `--help` for full options.

---

## <img src="assets/ctxscope-logo.svg" width="24" height="24" align="center" alt=""> Supported Agents

| Agent | Status | Files Detected |
|---|---|---|
| Codex | Native | `AGENTS.md`, `**/AGENTS.md` |
| OpenCode | Native | `AGENTS.md`, `**/AGENTS.md`, `.opencode/**/*.md`, `.opencode/skills/**/SKILL.md` |
| Claude Code | Native | `CLAUDE.md`, `**/CLAUDE.md`, `AGENTS.md` |
| Cursor | Pattern-based | `.cursor/rules/**` |
| GitHub Copilot | Pattern-based | `.github/copilot-instructions.md` |
| Gemini CLI | Pattern-based | `GEMINI.md` (`generate` only) |
| Windsurf | Pattern-based | `.windsurf/rules/ctxscope-generated.md` (`generate` only) |
| Generic | Pattern-based | `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, `**/SKILL.md`, `.cursor/rules/**`, `.github/copilot-instructions.md` |

Pattern-based discovery is intentionally conservative. See [agent support](docs/agent-support.md).

---

## <img src="assets/ctxscope-logo.svg" width="24" height="24" align="center" alt=""> Safety Promise

- No AI-generated edits.
- `fix` only writes files when explicitly invoked.
- `fix --dry-run` prints the diff before changing anything.
- Missing scripts and missing paths are recommendations, not guessed rewrites.
- Generated files are not overwritten without `--force`.
- Git comparison commands do not mutate the working tree.

See [safety](docs/safety.md) for details.

---

## <img src="assets/ctxscope-logo.svg" width="24" height="24" align="center" alt=""> Documentation

- [Diagnostics](docs/diagnostics.md)
- [Configuration](docs/configuration.md)
- [Scoring](docs/scoring.md)
- [Agent support](docs/agent-support.md)
- [Safety model](docs/safety.md)

---

## <img src="assets/ctxscope-logo.svg" width="24" height="24" align="center" alt=""> FAQ

<details>
<summary><b>How is this different from reading the files myself?</b></summary>
<br/>

Manually checking every agent instruction after repository changes is slow and easy to forget. `ctxscope` turns that review into one local command: it validates explicit commands and paths, detects conflicts and duplicates, estimates token overhead, and previews deterministic fixes.
</details>

<details>
<summary><b>Can I use it in CI?</b></summary>
<br/>

Yes. `ctxscope diagnose --ci` exits with code 1 when configured errors are present. CI is supported, but the primary workflow is local: diagnose, preview, apply, and compare before changes surprise your agents.
</details>

<details>
<summary><b>How accurate are token estimates?</b></summary>
<br/>

Token counts use `ceil(character_count / 4)`. They are useful for budgeting and comparison, not exact provider billing.
</details>

---

<div align="center">
  <br/>
  <img src="assets/ctxscope-logo.svg" width="48" height="48" alt="">
  <br/>
  <br/>

  Created by [tuple](https://github.com/x6txy).

  Telegram: [@ncglx](https://t.me/ncglx) &nbsp;·&nbsp; Email: baha200477@gmail.com

  [MIT License](LICENSE)

  <br/>
  <i>Keep your agents honest.</i>
</div>
