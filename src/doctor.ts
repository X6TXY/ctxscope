import { scanContext } from "./scan.js";
import { collectBudgetDiagnostics } from "./rules/budget.js";
import { collectPackageManagerDiagnostics } from "./rules/package-manager.js";
import { collectPackageScriptDiagnostics } from "./rules/package-scripts.js";
import { collectPathDiagnostics } from "./rules/repository-paths.js";
import { collectToolCommandDiagnostics } from "./rules/tool-commands.js";
import { collectSkillBloatDiagnostics } from "./rules/skill-bloat.js";
import { sortDiagnostics } from "./diagnostics.js";
import { calculateContextScore, calculateScoreBreakdown } from "./score.js";
import type { Agent, CtxscopeConfig, DoctorResult } from "./types.js";

export function runDoctor(target: string, agent: Agent, config: CtxscopeConfig): DoctorResult {
  const scan = scanContext(target, agent, config);
  const diagnostics = sortDiagnostics([
    ...scan.warnings,
    ...collectBudgetDiagnostics(scan, config),
    ...collectPackageManagerDiagnostics(target, scan.files, config),
    ...collectPackageScriptDiagnostics(target, scan.files, config),
    ...collectPathDiagnostics(target, scan.files, config),
    ...collectToolCommandDiagnostics(target, scan.files, config),
    ...collectSkillBloatDiagnostics(agent, config),
  ]);
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warn").length;

  return {
    agent: scan.agent,
    target: scan.target,
    status: errors > 0 ? "fail" : "pass",
    summary: {
      files: scan.files.length,
      totalTokens: scan.totalTokens,
      warnings,
      errors,
    },
    score: calculateContextScore(scan, diagnostics, config),
    scoreBreakdown: calculateScoreBreakdown(scan, diagnostics, config),
    files: scan.files,
    diagnostics,
  };
}
