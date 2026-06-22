import { statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { agentsForPath, matchesAgentFilter } from "./agents.js";
import { DEFAULT_CONFIG } from "./config.js";
import { listFiles } from "./files.js";
import { estimateFileTokens } from "./token.js";
import type { Agent, ContextFile, CtxscopeConfig, ScanResult } from "./types.js";
import { collectDiagnostics } from "./warnings.js";

export function scanContext(target: string, agent: Agent, config: CtxscopeConfig = DEFAULT_CONFIG): ScanResult {
  const root = getScanRoot(target);
  const absoluteFiles = listFiles(target);
  const discoveredFiles = absoluteFiles
    .map<ContextFile | null>((absolutePath) => {
      const path = normalizeRelativePath(relative(root, absolutePath));
      const agents = agentsForPath(path);

      if (agents.length === 0 || !matchesAgentFilter(agents, agent)) {
        return null;
      }

      const estimate = estimateFileTokens(absolutePath);

      return {
        path,
        agents,
        tokens: estimate.tokens,
        skippedBinary: estimate.skipped,
      };
    })
    .filter((file): file is ContextFile => file !== null)
    .sort((a, b) => a.path.localeCompare(b.path));

  const absoluteByPath = new Map(absoluteFiles.map((absolutePath) => [
    normalizeRelativePath(relative(root, absolutePath)),
    absolutePath,
  ]));
  const warningInputs = discoveredFiles
    .map((file) => ({ file, absolutePath: absoluteByPath.get(file.path) }))
    .filter((input): input is { file: ContextFile; absolutePath: string } => input.absolutePath !== undefined);

  return {
    agent,
    target,
    files: discoveredFiles,
    totalTokens: discoveredFiles.reduce((total, file) => total + file.tokens, 0),
    warnings: collectDiagnostics(warningInputs, config),
  };
}

function getScanRoot(target: string): string {
  const absoluteTarget = resolve(target);
  const stat = statSync(absoluteTarget);
  return stat.isDirectory() ? absoluteTarget : dirname(absoluteTarget);
}

function normalizeRelativePath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized === "" ? "." : normalized;
}
