import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createDiagnostic, sortDiagnostics } from "../diagnostics.js";
import type { ContextFile, CtxscopeConfig, Diagnostic } from "../types.js";

type ScriptMention = {
  path: string;
  script: string;
};

const SCRIPT_PATTERNS = [
  /\bnpm\s+run\s+([a-z0-9:_-]+)\b/gi,
  /\bpnpm\s+(?!run\b|install\b|add\b|remove\b|exec\b|dlx\b|create\b|init\b)([a-z0-9:_-]+)\b/gi,
  /\byarn\s+(?!run\b|install\b|add\b|remove\b|exec\b|dlx\b|create\b|init\b)([a-z0-9:_-]+)\b/gi,
  /\bbun\s+run\s+([a-z0-9:_-]+)\b/gi,
];

export function collectPackageScriptDiagnostics(
  target: string,
  files: ContextFile[],
  config: CtxscopeConfig,
): Diagnostic[] {
  const root = getScanRoot(target);
  const scripts = readPackageScripts(root);

  if (!scripts) {
    return [];
  }

  const mentions = files.flatMap((file) => collectScriptMentions(root, file));
  const seen = new Set<string>();
  const diagnostics: Diagnostic[] = [];

  for (const mention of mentions) {
    if (scripts.has(mention.script)) {
      continue;
    }

    const key = `${mention.path}:${mention.script}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const diagnostic = createDiagnostic({
      code: "CTX102",
      defaultSeverity: "error",
      path: mention.path,
      message: `references missing package script: ${mention.script}`,
    }, config);

    if (diagnostic) {
      diagnostics.push(diagnostic);
    }
  }

  return sortDiagnostics(diagnostics);
}

function collectScriptMentions(root: string, file: ContextFile): ScriptMention[] {
  if (file.skippedBinary) {
    return [];
  }

  const absolutePath = resolve(root, file.path);
  const content = readFileSync(absolutePath, "utf8");
  const mentions: ScriptMention[] = [];

  for (const pattern of SCRIPT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const script = match[1];
      if (script) {
        mentions.push({ path: file.path, script });
      }
    }
  }

  return mentions;
}

function readPackageScripts(root: string): Set<string> | null {
  const packageJsonPath = resolve(root, "package.json");

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { scripts?: Record<string, unknown> };
  return new Set(Object.entries(parsed.scripts ?? {})
    .filter(([, value]) => typeof value === "string")
    .map(([script]) => script));
}

function getScanRoot(target: string): string {
  const absoluteTarget = resolve(target);
  const stat = statSync(absoluteTarget);
  return stat.isDirectory() ? absoluteTarget : dirname(absoluteTarget);
}
