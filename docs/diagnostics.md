# Diagnostics

`ctxscope diagnose` reports diagnostics for stale, inconsistent, duplicated, or expensive agent context.

| Code | Default | Meaning | Safe Autofix |
|---|---:|---|---:|
| `CTX001` | warn | Context file exceeds `maxFileTokens` | no |
| `CTX002` | warn | Duplicate heading across context files | no |
| `CTX003` | warn | Stale relative markdown link | no |
| `CTX004` | warn | Empty context file | no |
| `CTX005` | warn | TODO, FIXME, or obsolete marker | no |
| `CTX006` | warn | Repeated paragraph | yes |
| `CTX101` | error | Conflicting package manager instructions | yes |
| `CTX102` | error | Missing package script referenced by context | no |
| `CTX103` | warn | Referenced repository path does not exist | no |
| `CTX104` | warn | Unrecognized command reference | no |
| `CTX105` | error | Total context budget exceeded | no |

Use `ctxscope explain <code>` for terminal-native help:

```bash
ctxscope explain CTX102
```

Severity can be changed in `ctxscope.config.json` with `off`, `warn`, or `error`.

```json
{
  "rules": {
    "CTX103": "warn",
    "CTX104": "off"
  }
}
```
