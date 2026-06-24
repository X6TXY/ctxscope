import type { ContextScore, CtxscopeConfig, Diagnostic, ScanResult, ScoreBreakdown, ScorePenalty } from "./types.js";

const CATEGORY_RULES: Record<Exclude<keyof ContextScore, "overall">, string[]> = {
  correctness: ["CTX101", "CTX102", "CTX103", "CTX104", "CTX106"],
  freshness: ["CTX003", "CTX005"],
  efficiency: ["CTX001", "CTX006", "CTX105"],
  consistency: ["CTX002", "CTX101"],
  coverage: [],
};

export function calculateContextScore(scan: ScanResult, diagnostics: Diagnostic[], config: CtxscopeConfig): ContextScore {
  const { errors, warnings, budgetPenalty, duplicationPenalty } = calculateOverallPenalties(scan, diagnostics, config);
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

export function calculateScoreBreakdown(scan: ScanResult, diagnostics: Diagnostic[], config: CtxscopeConfig): ScoreBreakdown {
  const budgetPenalty = calculateBudgetPenalty(scan, config);
  const duplicationPenalty = calculateDuplicationPenalty(diagnostics);

  return {
    correctness: categoryBreakdown(diagnostics, CATEGORY_RULES.correctness),
    freshness: categoryBreakdown(diagnostics, CATEGORY_RULES.freshness),
    efficiency: categoryBreakdown(diagnostics, CATEGORY_RULES.efficiency, [
      budgetPenalty > 0 ? {
        code: "budget",
        count: 1,
        deduction: budgetPenalty,
        message: `total context exceeds maxTokens (${config.maxTokens})`,
      } : null,
      duplicationPenalty > 0 ? {
        code: "duplication",
        count: diagnostics.filter((diagnostic) => diagnostic.code === "CTX006").length,
        deduction: duplicationPenalty,
        message: "repeated paragraph pressure",
      } : null,
    ].filter((penalty): penalty is ScorePenalty => penalty !== null)),
    consistency: categoryBreakdown(diagnostics, CATEGORY_RULES.consistency),
    coverage: {
      score: scan.files.length === 0 ? 70 : 100,
      penalties: scan.files.length === 0 ? [{
        code: "coverage",
        count: 1,
        deduction: 30,
        message: "no agent context files discovered",
      }] : [],
    },
  };
}

function calculateOverallPenalties(scan: ScanResult, diagnostics: Diagnostic[], config: CtxscopeConfig): {
  errors: number;
  warnings: number;
  budgetPenalty: number;
  duplicationPenalty: number;
} {
  return {
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warn").length,
    budgetPenalty: calculateBudgetPenalty(scan, config),
    duplicationPenalty: calculateDuplicationPenalty(diagnostics),
  };
}

function calculateBudgetPenalty(scan: ScanResult, config: CtxscopeConfig): number {
  return scan.totalTokens > config.maxTokens
    ? Math.min(Math.ceil(((scan.totalTokens - config.maxTokens) / config.maxTokens) * 20), 20)
    : 0;
}

function calculateDuplicationPenalty(diagnostics: Diagnostic[]): number {
  return Math.min(diagnostics.filter((diagnostic) => diagnostic.code === "CTX006").length * 8, 16);
}

function categoryScore(diagnostics: Diagnostic[], codes: string[]): number {
  return categoryBreakdown(diagnostics, codes).score;
}

function categoryBreakdown(diagnostics: Diagnostic[], codes: string[], extraPenalties: ScorePenalty[] = []): { score: number; penalties: ScorePenalty[] } {
  const relevant = diagnostics.filter((diagnostic) => codes.includes(diagnostic.code));
  const errors = relevant.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = relevant.filter((diagnostic) => diagnostic.severity === "warn").length;
  const baseDeduction = Math.min(errors * 22, 66) + Math.min(warnings * 10, 40);
  const extraDeduction = extraPenalties.reduce((total, penalty) => total + penalty.deduction, 0);
  const penalties = [...diagnosticPenalties(relevant), ...extraPenalties];

  return {
    score: clampScore(100 - baseDeduction - extraDeduction),
    penalties,
  };
}

function diagnosticPenalties(diagnostics: Diagnostic[]): ScorePenalty[] {
  const byCode = new Map<string, Diagnostic[]>();

  for (const diagnostic of diagnostics) {
    const current = byCode.get(diagnostic.code) ?? [];
    current.push(diagnostic);
    byCode.set(diagnostic.code, current);
  }

  return [...byCode.entries()].map(([code, items]) => {
    const errors = items.filter((diagnostic) => diagnostic.severity === "error").length;
    const warnings = items.filter((diagnostic) => diagnostic.severity === "warn").length;

    return {
      code,
      count: items.length,
      deduction: Math.min(errors * 22, 66) + Math.min(warnings * 10, 40),
      message: items[0]?.message ?? "diagnostic penalty",
    };
  });
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
