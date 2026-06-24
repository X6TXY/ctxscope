import { existsSync } from "node:fs";
import { join } from "node:path";

import { scanSkillDirs, type SkillScanResult } from "./skill-scan.js";
import { getAgentSkillDirs } from "./skill-categorize.js";
import { runOptimize, undoOptimize, type PointerGenerationResult } from "./skill-pointer.js";
import { loadCategoryMap } from "./skill-categories-config.js";
import { promptSkillCategories } from "./prompt-categories.js";
import type { Agent } from "./types.js";

export type OptimizeResult = {
  target: Agent;
  before: SkillScanResult;
  after: SkillScanResult | null;
  pointers: PointerGenerationResult;
  undo: boolean;
  dryRun: boolean;
  vaultDir: string;
};

export type OptimizeOptions = {
  target: Agent;
  vaultDir?: string;
  dryRun: boolean;
  undo: boolean;
  noninteractive: boolean;
};

function getDefaultVaultDir(): string {
  return join(process.cwd(), ".ctxscope-vault");
}

export async function runOptimizeCommand(options: OptimizeOptions): Promise<OptimizeResult> {
  const vaultDir = options.vaultDir ?? getDefaultVaultDir();
  const dirs = getAgentSkillDirs(options.target, process.cwd())
    .filter((d) => existsSync(d))
    .sort((a, b) => {
      const aProj = a.startsWith(process.cwd());
      const bProj = b.startsWith(process.cwd());
      if (aProj && !bProj) return -1;
      if (!aProj && bProj) return 1;
      return 0;
    });
  const before = scanSkillDirs(dirs);

  if (options.undo) {
    if (dirs.length === 0) {
      return {
        target: options.target,
        before,
        after: null,
        pointers: { pointers: [], migratedCount: 0 },
        undo: true,
        dryRun: options.dryRun,
        vaultDir,
      };
    }

    if (!existsSync(vaultDir)) {
      return {
        target: options.target,
        before,
        after: before,
        pointers: { pointers: [], migratedCount: 0 },
        undo: true,
        dryRun: options.dryRun,
        vaultDir,
      };
    }

    const undoResult = undoOptimize(dirs, vaultDir, options.dryRun);

    const after = scanSkillDirs(dirs);
    return {
      target: options.target,
      before,
      after,
      pointers: { pointers: [], migratedCount: undoResult.restoredCount },
      undo: true,
      dryRun: options.dryRun,
      vaultDir,
    };
  }

  if (before.skills.length === 0) {
    return {
      target: options.target,
      before,
      after: before,
      pointers: { pointers: [], migratedCount: 0 },
      undo: false,
      dryRun: options.dryRun,
      vaultDir,
    };
  }

  if (dirs.length === 0) {
    return {
      target: options.target,
      before,
      after: before,
      pointers: { pointers: [], migratedCount: 0 },
      undo: false,
      dryRun: options.dryRun,
      vaultDir,
    };
  }

  if (!options.dryRun && !options.noninteractive) {
    await promptSkillCategories(before.skills, process.cwd());
  }

  const categoryMap = loadCategoryMap(process.cwd());
  const pointers = runOptimize(before, vaultDir, options.dryRun, categoryMap ?? undefined);
  const after = options.dryRun ? null : scanSkillDirs(dirs);

  return {
    target: options.target,
    before,
    after,
    pointers,
    undo: false,
    dryRun: options.dryRun,
    vaultDir,
  };
}

export function formatOptimizeResult(result: OptimizeResult): string {
  const sections: string[] = [];

  if (result.undo) {
    if (result.dryRun) {
      sections.push("ctxscope optimize --undo --dry-run");
      sections.push(`Would restore ${result.pointers.migratedCount} skills from vault`);
    } else {
      sections.push("ctxscope optimize --undo");
      sections.push(`Restored ${result.pointers.migratedCount} skills from vault`);
    }

    if (result.after) {
      sections.push(`Skills now: ${result.after.skills.length} (~${result.after.totalTokenCost} tokens)`);
    }

    return sections.join("\n");
  }

  if (result.dryRun) {
    sections.push(`ctxscope optimize --dry-run (agent: ${result.target})`);
    sections.push("");
    sections.push(`Found ${result.before.skills.length} skills (~${result.before.totalTokenCost} tokens for descriptions)`);
    sections.push("");

    if (result.before.skills.length === 0) {
      sections.push("No skills to optimize.");
      return sections.join("\n");
    }

    sections.push("Would create pointers:");
    for (const p of result.pointers.pointers) {
      sections.push(`  ${p.category} (${p.skillCount} skills)`);
    }
    sections.push("");
    sections.push(`Estimated result: ~${result.before.skills.length} skills → ${result.pointers.pointers.length} pointers`);
    const estimatedTokens = Math.ceil(result.pointers.pointers.length * 60);
    sections.push(`Estimated token cost: ~${result.before.totalTokenCost} → ~${estimatedTokens} tokens (${Math.round((1 - estimatedTokens / result.before.totalTokenCost) * 100)}% reduction)`);
  } else {
    sections.push(`ctxscope optimize (agent: ${result.target})`);
    sections.push("");

    if (result.before.skills.length === 0) {
      sections.push("No skills to optimize.");
      return sections.join("\n");
    }

    sections.push(`Migrated ${result.pointers.migratedCount} skills to vault: ${result.vaultDir}`);
    sections.push(`Created ${result.pointers.pointers.length} category pointers`);
    sections.push("");

    if (result.after) {
      sections.push("Categories:");
      for (const p of result.pointers.pointers) {
        sections.push(`  ${p.category}: ${p.skillCount} skills`);
      }
      sections.push("");
      sections.push(`Before: ${result.before.skills.length} skills (~${result.before.totalTokenCost} tokens)`);
      sections.push(`After:  ${result.pointers.pointers.length} pointers (~${result.after.totalTokenCost} tokens)`);
      const saved = result.before.totalTokenCost - result.after.totalTokenCost;
      const pct = Math.round((saved / result.before.totalTokenCost) * 100);
      sections.push(`Saved: ~${saved} tokens per session (${pct}% reduction)`);
    }
  }

  return sections.join("\n");
}
