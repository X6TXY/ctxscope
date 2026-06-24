# Scoring

`ctxscope diagnose` reports an Agent Context Score from `0` to `100` plus five categories.

```text
Agent Context Score  64/100
  Correctness  56/100
  Freshness    100/100
  Efficiency   76/100
  Consistency  78/100
  Coverage     100/100
```

Categories:

- `Correctness`: invalid commands, missing scripts, missing paths, and package-manager conflicts.
- `Freshness`: stale links and TODO/FIXME/obsolete markers.
- `Efficiency`: oversized files, repeated paragraphs, and total context budget pressure.
- `Consistency`: duplicated headings and conflicting package-manager instructions.
- `Coverage`: whether any supported context files were discovered.

Use verbose mode for a penalty breakdown:

```bash
ctxscope diagnose --verbose
```

Example:

```text
Correctness  56/100
  -22  CTX102  references missing package script: test:e2e
  -10  CTX103  Referenced path does not exist: apps/api

Efficiency  76/100
  -10  CTX006  contains a repeated paragraph
  -8   duplication  repeated paragraph pressure
```

Score formulas are deterministic within a release. They may be tuned between releases as diagnostics improve.

Token estimates use `ceil(character_count / 4)`, which is suitable for relative budgeting but not exact provider billing.
