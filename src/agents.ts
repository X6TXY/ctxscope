import type { Agent, ConcreteAgent } from "./types.js";

const AGENT_ORDER: ConcreteAgent[] = ["codex", "opencode", "claude", "generic"];

export function agentsForPath(relativePath: string): ConcreteAgent[] {
  const normalized = normalizePath(relativePath);
  const fileName = basename(normalized);
  const agents = new Set<ConcreteAgent>();

  if (normalized.startsWith(".opencode/")) {
    agents.add("opencode");

    if (fileName === "SKILL.md") {
      agents.add("generic");
    }

    return AGENT_ORDER.filter((agent) => agents.has(agent));
  }

  if (fileName === "AGENTS.md") {
    agents.add("codex");
    agents.add("opencode");
    agents.add("claude");
    agents.add("generic");
  }

  if (fileName === "CLAUDE.md") {
    agents.add("claude");
    agents.add("generic");
  }

  if (fileName === "SKILL.md") {
    agents.add("generic");

    if (normalized.startsWith(".opencode/skills/")) {
      agents.add("opencode");
    }
  }

  if (normalized.startsWith(".cursor/rules/")) {
    agents.add("generic");
  }

  if (normalized === ".github/copilot-instructions.md") {
    agents.add("generic");
  }

  return AGENT_ORDER.filter((agent) => agents.has(agent));
}

export function matchesAgentFilter(agents: ConcreteAgent[], filter: Agent): boolean {
  return filter === "all" || agents.includes(filter);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}
