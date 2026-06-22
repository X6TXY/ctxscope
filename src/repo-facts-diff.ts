import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectRepoFacts, type RepoFacts } from "./repo-facts.js";

export type RepoFactsDelta = {
  packageManagerChanged: boolean;
  packageManagerBefore?: string;
  packageManagerAfter?: string;
  scriptsAdded: string[];
  scriptsRemoved: string[];
  scriptsChanged: Array<{ name: string; before: string; after: string }>;
  sourceDirectoriesAdded: string[];
  sourceDirectoriesRemoved: string[];
  toolsAdded: string[];
  toolsRemoved: string[];
  hasChanges: boolean;
};

export function detectRepoFactsAtRef(root: string, ref: string): RepoFacts {
  const content = readFileFromGit(root, ref);
  if (!content) {
    return emptyFacts();
  }

  return parseRepoFactsFromJson(content);
}

function readFileFromGit(root: string, ref: string): string | null {
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const result = execSync(`git show ${ref}:package.json`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result;
  } catch {
    return null;
  }
}

function parseRepoFactsFromJson(content: string): RepoFacts {
  try {
    const pkg = JSON.parse(content) as Record<string, unknown>;
    const scripts = typeof pkg.scripts === "object" && pkg.scripts !== null
      ? pkg.scripts as Record<string, string>
      : {};
    const packageName = typeof pkg.name === "string" ? pkg.name : undefined;

    const detectedTools: string[] = [];
    if (scripts.build) detectedTools.push("build");
    if (scripts.test) detectedTools.push("test");
    if (scripts.lint) detectedTools.push("lint");

    return {
      packageManager: undefined,
      scripts,
      packageName,
      bin: pkg.bin,
      sourceDirectories: [],
      docsDirectories: [],
      detectedTools,
      readmeHeadings: [],
    };
  } catch {
    return emptyFacts();
  }
}

function emptyFacts(): RepoFacts {
  return {
    scripts: {},
    sourceDirectories: [],
    docsDirectories: [],
    detectedTools: [],
    readmeHeadings: [],
  };
}

export function computeRepoFactsDelta(current: RepoFacts, previous: RepoFacts): RepoFactsDelta {
  const currentScriptNames = new Set(Object.keys(current.scripts));
  const previousScriptNames = new Set(Object.keys(previous.scripts));

  const scriptsAdded: string[] = [];
  const scriptsRemoved: string[] = [];
  const scriptsChanged: Array<{ name: string; before: string; after: string }> = [];

  for (const name of currentScriptNames) {
    if (!previousScriptNames.has(name)) {
      scriptsAdded.push(name);
    } else if (current.scripts[name] !== previous.scripts[name]) {
      scriptsChanged.push({ name, before: previous.scripts[name] ?? "", after: current.scripts[name] ?? "" });
    }
  }

  for (const name of previousScriptNames) {
    if (!currentScriptNames.has(name)) {
      scriptsRemoved.push(name);
    }
  }

  const currentSourceSet = new Set(current.sourceDirectories);
  const previousSourceSet = new Set(previous.sourceDirectories);
  const sourceDirectoriesAdded = current.sourceDirectories.filter((d) => !previousSourceSet.has(d));
  const sourceDirectoriesRemoved = previous.sourceDirectories.filter((d) => !currentSourceSet.has(d));

  const currentToolSet = new Set(current.detectedTools);
  const previousToolSet = new Set(previous.detectedTools);
  const toolsAdded = current.detectedTools.filter((t) => !previousToolSet.has(t));
  const toolsRemoved = previous.detectedTools.filter((t) => !currentToolSet.has(t));

  const hasChanges = scriptsAdded.length > 0
    || scriptsRemoved.length > 0
    || scriptsChanged.length > 0
    || sourceDirectoriesAdded.length > 0
    || sourceDirectoriesRemoved.length > 0
    || toolsAdded.length > 0
    || toolsRemoved.length > 0
    || current.packageManager !== previous.packageManager;

  return {
    packageManagerChanged: current.packageManager !== previous.packageManager,
    packageManagerBefore: previous.packageManager,
    packageManagerAfter: current.packageManager,
    scriptsAdded,
    scriptsRemoved,
    scriptsChanged,
    sourceDirectoriesAdded,
    sourceDirectoriesRemoved,
    toolsAdded,
    toolsRemoved,
    hasChanges,
  };
}

export function formatDeltaHuman(delta: RepoFactsDelta): string {
  const lines: string[] = [];

  if (delta.packageManagerChanged) {
    lines.push(`  Package manager changed: ${delta.packageManagerBefore ?? "none"} -> ${delta.packageManagerAfter ?? "none"}`);
  }

  if (delta.scriptsAdded.length > 0) {
    lines.push("  Scripts added:");
    for (const name of delta.scriptsAdded) {
      lines.push(`    ${name}`);
    }
  }

  if (delta.scriptsRemoved.length > 0) {
    lines.push("  Scripts removed:");
    for (const name of delta.scriptsRemoved) {
      lines.push(`    ${name}`);
    }
  }

  if (delta.scriptsChanged.length > 0) {
    lines.push("  Scripts changed:");
    for (const { name, before, after } of delta.scriptsChanged) {
      lines.push(`    ${name}: ${before} -> ${after}`);
    }
  }

  if (delta.sourceDirectoriesAdded.length > 0) {
    lines.push("  Source directories added:");
    for (const name of delta.sourceDirectoriesAdded) {
      lines.push(`    ${name}/`);
    }
  }

  if (delta.sourceDirectoriesRemoved.length > 0) {
    lines.push("  Source directories removed:");
    for (const name of delta.sourceDirectoriesRemoved) {
      lines.push(`    ${name}/`);
    }
  }

  if (delta.toolsAdded.length > 0) {
    lines.push("  Tools detected:");
    for (const name of delta.toolsAdded) {
      lines.push(`    ${name}`);
    }
  }

  if (delta.toolsRemoved.length > 0) {
    lines.push("  Tools no longer detected:");
    for (const name of delta.toolsRemoved) {
      lines.push(`    ${name}`);
    }
  }

  return lines.join("\n");
}
