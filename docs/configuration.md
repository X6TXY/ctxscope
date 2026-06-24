# Configuration

Create a config file with:

```bash
ctxscope init --config
```

Default shape:

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

Fields:

- `maxTokens`: repository-wide context budget used by `doctor` and `cost`.
- `maxFileTokens`: per-file context budget used by `CTX001`.
- `ignore`: directories excluded from scanning.
- `rules`: per-diagnostic severity override.

Severity values are `off`, `warn`, and `error`.

CI is optional:

```bash
ctxscope diagnose --ci
```

Under `--ci`, configured errors cause exit code `1`; warnings do not.
