import { existsSync } from "node:fs";

import { createDiagnostic } from "../diagnostics.js";
import { scanSkillDirs } from "../skill-scan.js";
import { getAgentSkillDirs } from "../skill-categorize.js";
import type { Agent, CtxscopeConfig, Diagnostic } from "../types.js";

const WARN_THRESHOLD = 1000;
const ERROR_THRESHOLD = 5000;

export function collectSkillBloatDiagnostics(
  agent: Agent,
  config: CtxscopeConfig,
): Diagnostic[] {
  const dirs = getAgentSkillDirs(agent, process.cwd()).filter((d) => existsSync(d));
  if (dirs.length === 0) {
    return [];
  }

  const scan = scanSkillDirs(dirs);
  if (scan.totalTokenCost < WARN_THRESHOLD) {
    return [];
  }

  const severity = scan.totalTokenCost >= ERROR_THRESHOLD ? "error" as const : "warn" as const;

  const breakdown = scan.dirBreakdown
    .filter((b) => b.skillCount > 0)
    .map((b) => `  ${b.dir}: ${b.skillCount} skills, ~${b.descriptionTokens} tokens`)
    .join("\n");

  const heaviest = scan.skills
    .sort((a, b) => b.descriptionTokens - a.descriptionTokens)
    .slice(0, 3)
    .map((s) => `${s.dirName} (~${s.descriptionTokens} tokens)`)
    .join(", ");

  let recommendation: string;
  if (scan.totalTokenCost > WARN_THRESHOLD * 3) {
    recommendation = `Use \`ctxscope optimize\` to reduce startup token cost from ~${scan.totalTokenCost} to ~${Math.ceil(scan.dirBreakdown.length * 70)}`;
  } else {
    recommendation = `Consider consolidating skill descriptions or using \`ctxscope optimize\``;
  }

  const message = [
    `${scan.skills.length} skills in agent directories (~${scan.totalTokenCost} tokens for descriptions)`,
    breakdown,
    heaviest ? `Heaviest: ${heaviest}` : "",
  ].filter(Boolean).join("\n");

  const diagnostic = createDiagnostic({
    code: "CTX106",
    defaultSeverity: severity,
    path: "agent-skills",
    message,
    recommendation,
  }, config);

  return diagnostic ? [diagnostic] : [];
}
