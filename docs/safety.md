# Safety Model

`ctxscope` is designed for trust over magic.

Safe behavior:

- No AI-generated edits.
- `doctor`, `scan`, `top`, `cost`, and `explain` are read-only.
- `fix --dry-run` prints diffs without writing files.
- `fix` only applies deterministic safe repairs.
- `generate` does not overwrite existing files unless `--force` is passed.
- `diagnose --diff` reads Git refs into a temporary directory and does not run `git checkout`.

Safe autofixes currently include:

- `CTX006`: remove repeated paragraphs.
- `CTX101`: normalize package-manager command forms to the lockfile-detected package manager.

Non-autofixed diagnostics are intentionally conservative. For example, `CTX102` can identify a missing package script, but it will not guess which script name you meant.
