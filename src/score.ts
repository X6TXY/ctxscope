import type { ContextScore, CtxscopeConfig, Diagnostic, ScanResult } from "./types.js";

const CATEGORY_RULES: Record<Exclude<keyof ContextScore, "overall">, string[]> = {
  correctness: ["CTX101", "CTX102"],
  freshness: ["CTX003", "CTX005"],
  efficiency: ["CTX001", "CTX006", "CTX105"],
  consistency: ["CTX002", "CTX101"],
  coverage: [],
};

export function calculateContextScore(scan: ScanResult, diagnostics: Diagnostic[], config: CtxscopeConfig): ContextScore {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warn").length;
  const budgetPenalty = scan.totalTokens > config.maxTokens
    ? Math.min(Math.ceil(((scan.totalTokens - config.maxTokens) / config.maxTokens) * 20), 20)
    : 0;
  const duplicationPenalty = Math.min(diagnostics.filter((diagnostic) => diagnostic.code === "CTX006").length * 8, 16);
  const overall = clampScore(100
    - Math.min(errors * 18, 54)
    - Math.min(warnings * 6, 30)
    - budgetPenalty
    - duplicationPenalty);

  return {
    overall,
    correctness: categoryScore(diagnostics, CATEGORY_RULES.correctness),
    freshness: categoryScore(diagnostics, CATEGORY_RULES.freshness),
    efficiency: clampScore(categoryScore(diagnostics, CATEGORY_RULES.efficiency) - budgetPenalty - duplicationPenalty),
    consistency: categoryScore(diagnostics, CATEGORY_RULES.consistency),
    coverage: scan.files.length === 0 ? 70 : 100,
  };
}

function categoryScore(diagnostics: Diagnostic[], codes: string[]): number {
  const relevant = diagnostics.filter((diagnostic) => codes.includes(diagnostic.code));
  const errors = relevant.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = relevant.filter((diagnostic) => diagnostic.severity === "warn").length;

  return clampScore(100 - Math.min(errors * 22, 66) - Math.min(warnings * 10, 40));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
