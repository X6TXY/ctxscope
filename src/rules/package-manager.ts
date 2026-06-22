import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createDiagnostic, sortDiagnostics } from "../diagnostics.js";
import { firstRegexLocation } from "../locations.js";
import type { ContextFile, CtxscopeConfig, Diagnostic } from "../types.js";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

type PackageManagerMention = {
  manager: PackageManager;
  path: string;
  line?: number;
  column?: number;
};

const PACKAGE_MANAGER_PATTERNS: Array<[PackageManager, RegExp]> = [
  ["npm", /\bnpm\s+(?:run\s+)?[a-z0-9:_-]+\b/i],
  ["pnpm", /\bpnpm\s+(?:run\s+)?[a-z0-9:_-]+\b/i],
  ["yarn", /\byarn\s+(?:run\s+)?[a-z0-9:_-]+\b/i],
  ["bun", /\bbun\s+(?:run\s+)?[a-z0-9:_-]+\b/i],
];

const LOCKFILES: Array<[PackageManager, string]> = [
  ["pnpm", "pnpm-lock.yaml"],
  ["npm", "package-lock.json"],
  ["yarn", "yarn.lock"],
  ["bun", "bun.lock"],
  ["bun", "bun.lockb"],
];

export function collectPackageManagerDiagnostics(
  target: string,
  files: ContextFile[],
  config: CtxscopeConfig,
): Diagnostic[] {
  const root = getScanRoot(target);
  const mentions = files.flatMap((file) => collectPackageManagerMentions(root, file));
  const managers = [...new Set(mentions.map((mention) => mention.manager))].sort();
  const lockfileManager = detectPackageManagerFromLockfiles(root);

  if (managers.length < 2) {
    return [];
  }

  const involvedPaths = [...new Set(mentions.map((mention) => mention.path))].sort();
  const diagnostics = involvedPaths
    .map((path) => {
      const mention = mentions.find((candidate) => candidate.path === path);
      return createDiagnostic({
      code: "CTX101",
      defaultSeverity: "error",
      path,
      message: `conflicting package managers: ${managers.join(", ")}`,
      line: mention?.line,
      column: mention?.column,
      recommendation: "use one package manager consistently in agent instructions",
      fix: lockfileManager ? {
        title: "Normalize package manager commands",
        kind: "replace",
        safe: true,
      } : undefined,
    }, config);
    })
    .filter((diagnostic): diagnostic is Diagnostic => diagnostic !== null);

  return sortDiagnostics(diagnostics);
}

export function detectPackageManagerFromLockfiles(root: string): PackageManager | null {
  const detected = LOCKFILES
    .filter(([, lockfile]) => existsSync(resolve(root, lockfile)))
    .map(([manager]) => manager);
  const unique = [...new Set(detected)];

  return unique.length === 1 ? unique[0] ?? null : null;
}

function collectPackageManagerMentions(root: string, file: ContextFile): PackageManagerMention[] {
  if (file.skippedBinary) {
    return [];
  }

  const absolutePath = resolve(root, file.path);
  const content = readFileSync(absolutePath, "utf8");
  const mentions: PackageManagerMention[] = [];

  for (const [manager, pattern] of PACKAGE_MANAGER_PATTERNS) {
    const location = firstRegexLocation(content, new RegExp(pattern.source, pattern.flags));
    if (location) {
      mentions.push({ manager, path: file.path, line: location.line, column: location.column });
    }
  }

  return mentions;
}

function getScanRoot(target: string): string {
  const absoluteTarget = resolve(target);
  const stat = statSync(absoluteTarget);
  return stat.isDirectory() ? absoluteTarget : dirname(absoluteTarget);
}
