# ctxscope v0.2 Plan

## Overview

Turn `ctxscope` from a context scanner into a CI-ready context linter. v0.2 adds configuration, diagnostics with `warn` and `error`, `doctor`, `--ci`, and high-value rules that catch broken agent instructions before they enter a repo.

## Goals

- Add configurable budgets and rule severities.
- Add `ctxscope doctor` for lint-style diagnostics.
- Add `--ci` exit codes so teams can use ctxscope in pull requests.
- Keep v0.2 deterministic and local. No AI review, network calls, or tracing.

## Architecture Decisions

- Preserve `scan` output from v0.1.
- Introduce a config loader before diagnostics so rule severity can be centralized.
- Keep config JSON-only for v0.2: `ctxscope.config.json`.
- Defer `.ctxscoperc` until there is user demand.

## Scope

### In Scope

- `ctxscope.config.json` defaults and validation.
- `Diagnostic` model with `warn` and `error`.
- `ctxscope doctor`, `ctxscope doctor --ci`, and `ctxscope doctor --json`.
- Rules: package manager conflict, missing package script, total context budget.
- `ctxscope init` to create a default config.
- README, CHANGELOG, and version bump to `0.2.0`.

### Out of Scope

- `trace`.
- `diff`.
- Web UI.
- Autofix.
- AI semantic review.
- Exact runtime loading for every agent.

## Tasks

1. Config loader.
2. Diagnostics model.
3. Doctor command.
4. Package manager conflict rule.
5. Missing package script rule.
6. Context budget rule.
7. Init command.
8. Docs and release.
