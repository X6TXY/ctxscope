import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { runDoctor } from "./doctor.js";
import { detectPackageManagerFromLockfiles, type PackageManager } from "./rules/package-manager.js";
import { unifiedDiff } from "./diff.js";
import type { Agent, ContextFile, CtxscopeConfig, DoctorResult } from "./types.js";

export type FixOptions = {
  dryRun: boolean;
  agent: Agent;
  target: string;
};

export type AppliedFix = {
  code: string;
  path: string;
  title: string;
  dryRun: boolean;
};

export type SkippedFix = {
  code: string;
  path: string;
  title: string;
  reason: string;
};

export type FixDiff = {
  path: string;
  diff: string;
};

export type FixResult = {
  target: string;
  applied: AppliedFix[];
  skipped: SkippedFix[];
  before: DoctorResult;
  after: DoctorResult;
  diffs: FixDiff[];
};

type FileEdit = {
  code: string;
  path: string;
  title: string;
  beforeContent: string;
  afterContent: string;
};

export function runFix(options: FixOptions, config: CtxscopeConfig): FixResult {
  const root = getScanRoot(options.target);
  const before = runDoctor(options.target, options.agent, config);
  const skipped = collectSkippedFixes(before);
  const edits = collectSafeEdits(root, before.files);
  const applied: AppliedFix[] = [];
  const diffs: FixDiff[] = [];

  for (const edit of edits) {
    applied.push({
      code: edit.code,
      path: edit.path,
      title: edit.title,
      dryRun: options.dryRun,
    });

    diffs.push({
      path: edit.path,
      diff: unifiedDiff(edit.beforeContent, edit.afterContent, edit.path),
    });

    if (!options.dryRun) {
      writeFileSync(resolve(root, edit.path), edit.afterContent);
    }
  }

  const after = options.dryRun ? before : runDoctor(options.target, options.agent, config);

  return {
    target: options.target,
    applied,
    skipped,
    before,
    after,
    diffs,
  };
}

function collectSafeEdits(root: string, files: ContextFile[]): FileEdit[] {
  const edits = new Map<string, FileEdit>();

  for (const edit of collectPackageManagerEdits(root, files)) {
    edits.set(edit.path, edit);
  }

  for (const edit of collectDuplicateParagraphEdits(root, files)) {
    const current = edits.get(edit.path);
    edits.set(edit.path, current
      ? { ...edit, beforeContent: current.beforeContent, afterContent: removeDuplicateParagraphs(current.afterContent) }
      : edit);
  }

  return [...edits.values()];
}

function collectPackageManagerEdits(root: string, files: ContextFile[]): FileEdit[] {
  const packageManager = detectPackageManagerFromLockfiles(root);

  if (!packageManager) {
    return [];
  }

  return files.flatMap((file) => {
    if (file.skippedBinary) {
      return [];
    }

    const absolutePath = resolve(root, file.path);
    const content = readFileSync(absolutePath, "utf8");
    const next = normalizePackageManagerCommands(content, packageManager);

    return next === content ? [] : [{
      code: "CTX101",
      path: file.path,
      title: `Normalize package manager commands to ${packageManager}`,
      beforeContent: content,
      afterContent: next,
    }];
  });
}

function collectDuplicateParagraphEdits(root: string, files: ContextFile[]): FileEdit[] {
  return files.flatMap((file) => {
    if (file.skippedBinary) {
      return [];
    }

    const absolutePath = resolve(root, file.path);
    const content = readFileSync(absolutePath, "utf8");
    const next = removeDuplicateParagraphs(content);

    return next === content ? [] : [{
      code: "CTX006",
      path: file.path,
      title: "Remove repeated paragraph",
      beforeContent: content,
      afterContent: next,
    }];
  });
}

function collectSkippedFixes(before: DoctorResult): SkippedFix[] {
  return before.diagnostics
    .filter((diagnostic) => diagnostic.code === "CTX102")
    .map((diagnostic) => ({
      code: diagnostic.code,
      path: diagnostic.path,
      title: "Replace missing package script reference",
      reason: "missing package script replacements are recommendations only in v0.3",
    }));
}

export function normalizePackageManagerCommands(content: string, packageManager: PackageManager): string {
  return content.replace(/\b(npm|pnpm|yarn|bun)\s+(run\s+)?([a-z0-9:_-]+)\b/gi, (match, current: string, runPrefix: string | undefined, command: string) => {
    const lowerCommand = command.toLowerCase();

    if (current.toLowerCase() === packageManager && commandFormMatches(packageManager, runPrefix, lowerCommand)) {
      return match;
    }

    if (["install", "add", "remove"].includes(lowerCommand)) {
      return `${packageManager} ${command}`;
    }

    if (["exec", "dlx", "create", "init"].includes(lowerCommand)) {
      return match;
    }

    if (packageManager === "npm") {
      return `npm run ${command}`;
    }

    if (packageManager === "bun") {
      return `bun run ${command}`;
    }

    return `${packageManager} ${command}`;
  });
}

export function removeDuplicateParagraphs(content: string): string {
  const parts = content.split(/(\n\s*\n)/);
  const seen = new Set<string>();
  const kept: string[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";

    if (index % 2 === 1) {
      kept.push(part);
      continue;
    }

    const normalized = part.trim().replace(/\s+/g, " ");
    if (normalized.length >= 40 && seen.has(normalized)) {
      if (kept.length > 0 && /^\n\s*\n$/.test(kept[kept.length - 1] ?? "")) {
        kept.pop();
      }
      continue;
    }

    if (normalized.length >= 40) {
      seen.add(normalized);
    }
    kept.push(part);
  }

  return kept.join("");
}

function commandFormMatches(packageManager: PackageManager, runPrefix: string | undefined, command: string): boolean {
  if (["install", "add", "remove", "exec", "dlx", "create", "init"].includes(command)) {
    return !runPrefix;
  }

  if (packageManager === "npm" || packageManager === "bun") {
    return Boolean(runPrefix);
  }

  return !runPrefix;
}

function getScanRoot(target: string): string {
  const absoluteTarget = resolve(target);
  const stat = statSync(absoluteTarget);
  return stat.isDirectory() ? absoluteTarget : dirname(absoluteTarget);
}
