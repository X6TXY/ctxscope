import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createDiagnostic, sortDiagnostics } from "../diagnostics.js";
import type { ContextFile, CtxscopeConfig, Diagnostic } from "../types.js";

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

type PackageManagerMention = {
  manager: PackageManager;
  path: string;
};

const PACKAGE_MANAGER_PATTERNS: Array<[PackageManager, RegExp]> = [
  ["npm", /\bnpm\s+(?:run\s+)?[a-z0-9:_-]+\b/i],
  ["pnpm", /\bpnpm\s+(?:run\s+)?[a-z0-9:_-]+\b/i],
  ["yarn", /\byarn\s+(?:run\s+)?[a-z0-9:_-]+\b/i],
  ["bun", /\bbun\s+(?:run\s+)?[a-z0-9:_-]+\b/i],
];

export function collectPackageManagerDiagnostics(
  target: string,
  files: ContextFile[],
  config: CtxscopeConfig,
): Diagnostic[] {
  const root = getScanRoot(target);
  const mentions = files.flatMap((file) => collectPackageManagerMentions(root, file));
  const managers = [...new Set(mentions.map((mention) => mention.manager))].sort();

  if (managers.length < 2) {
    return [];
  }

  const involvedPaths = [...new Set(mentions.map((mention) => mention.path))].sort();
  const diagnostics = involvedPaths
    .map((path) => createDiagnostic({
      code: "CTX101",
      defaultSeverity: "error",
      path,
      message: `conflicting package managers: ${managers.join(", ")}`,
    }, config))
    .filter((diagnostic): diagnostic is Diagnostic => diagnostic !== null);

  return sortDiagnostics(diagnostics);
}

function collectPackageManagerMentions(root: string, file: ContextFile): PackageManagerMention[] {
  if (file.skippedBinary) {
    return [];
  }

  const absolutePath = resolve(root, file.path);
  const content = readFileSync(absolutePath, "utf8");
  const mentions: PackageManagerMention[] = [];

  for (const [manager, pattern] of PACKAGE_MANAGER_PATTERNS) {
    if (pattern.test(content)) {
      mentions.push({ manager, path: file.path });
    }
  }

  return mentions;
}

function getScanRoot(target: string): string {
  const absoluteTarget = resolve(target);
  const stat = statSync(absoluteTarget);
  return stat.isDirectory() ? absoluteTarget : dirname(absoluteTarget);
}
