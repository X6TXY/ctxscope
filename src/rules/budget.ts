import { createDiagnostic } from "../diagnostics.js";
import type { CtxscopeConfig, Diagnostic, ScanResult } from "../types.js";

export function collectBudgetDiagnostics(scan: ScanResult, config: CtxscopeConfig): Diagnostic[] {
  if (scan.totalTokens <= config.maxTokens) {
    return [];
  }

  const diagnostic = createDiagnostic({
    code: "CTX105",
    defaultSeverity: "error",
    path: scan.target,
    message: `total context is ~${scan.totalTokens} tokens, budget is ${config.maxTokens}`,
  }, config);

  return diagnostic ? [diagnostic] : [];
}
