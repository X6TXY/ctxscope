import type { CtxscopeConfig, Diagnostic, RuleSeverity } from "./types.js";

type DiagnosticInput = Omit<Diagnostic, "severity"> & {
  defaultSeverity: Exclude<RuleSeverity, "off">;
};

export function createDiagnostic(input: DiagnosticInput, config: CtxscopeConfig): Diagnostic | null {
  const severity = config.rules[input.code] ?? input.defaultSeverity;

  if (severity === "off") {
    return null;
  }

  return {
    code: input.code,
    severity,
    path: input.path,
    message: input.message,
  };
}

export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort((a, b) => {
    const pathComparison = a.path.localeCompare(b.path);
    return pathComparison === 0 ? a.code.localeCompare(b.code) : pathComparison;
  });
}
