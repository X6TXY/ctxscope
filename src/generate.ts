import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type AgentTarget = "claude" | "codex" | "opencode" | "cursor" | "copilot" | "gemini" | "windsurf";

export type GenerateOptions = {
  agent: AgentTarget;
  root: string;
  dryRun: boolean;
  force: boolean;
  packageManager?: string;
  scripts: Record<string, string>;
  packageName?: string;
  bin?: Record<string, string> | string;
  sourceDirectories: string[];
  docsDirectories: string[];
  detectedTools: string[];
  readmeHeadings: string[];
};

export type GenerateResult = {
  path: string;
  written: boolean;
  content: string;
};

const AGENT_PATHS: Record<AgentTarget, string> = {
  claude: "CLAUDE.md",
  codex: "AGENTS.md",
  opencode: "AGENTS.md",
  cursor: ".cursor/rules/ctxscope-generated.mdc",
  copilot: ".github/copilot-instructions.md",
  gemini: "GEMINI.md",
  windsurf: ".windsurf/rules/ctxscope-generated.md",
};

function buildContent(options: GenerateOptions): string {
  const lines: string[] = [];
  lines.push("# Repository Instructions");
  lines.push("");

  if (options.packageManager) {
    lines.push("## Package Manager");
    lines.push("");
    lines.push(`Use ${options.packageManager}.`);
    lines.push("");
  }

  if (Object.keys(options.scripts).length > 0) {
    lines.push("## Common Commands");
    lines.push("");
    for (const [name, script] of Object.entries(options.scripts)) {
      if (options.packageManager) {
        const prefix = options.packageManager === "npm" ? "npm run" : options.packageManager;
        if (name === "build" || name === "test" || name === "lint") {
          lines.push(`- ${options.packageManager === "npm" ? "npm run" : options.packageManager} ${name}: ${script}`);
        }
      }
    }
    lines.push("");
  }

  if (options.sourceDirectories.length > 0 || options.docsDirectories.length > 0) {
    lines.push("## Project Structure");
    lines.push("");
    for (const dir of options.sourceDirectories) {
      lines.push(`- ${dir}/: source code`);
    }
    for (const dir of options.docsDirectories) {
      lines.push(`- ${dir}/: documentation`);
    }
    lines.push("");
  }

  lines.push("## Agent Rules");
  lines.push("");
  lines.push("- Follow the package manager and commands documented above.");
  lines.push("- Run tests before changing command instructions.");
  lines.push("- Do not assume missing package scripts exist.");

  return lines.join("\n");
}

export function getAgentPath(agent: AgentTarget): string {
  return AGENT_PATHS[agent];
}

export function generateInstructions(options: GenerateOptions): GenerateResult {
  const relativePath = AGENT_PATHS[options.agent];
  const absolutePath = resolve(options.root, relativePath);
  const content = buildContent(options);

  if (existsSync(absolutePath) && !options.force) {
    return {
      path: relativePath,
      written: false,
      content,
    };
  }

  if (!options.dryRun) {
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${content}\n`, "utf8");
  }

  return {
    path: relativePath,
    written: true,
    content,
  };
}

export function formatGenerateResultHuman(result: GenerateResult): string {
  if (result.written) {
    return `Created ${result.path}`;
  }
  return `${result.path} already exists. Use --force to overwrite.`;
}
