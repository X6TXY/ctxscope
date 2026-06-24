import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { categorizeSkill } from "./skill-categorize.js";
import { applyCategoryMap } from "./skill-categories-config.js";
import type { SkillInfo, SkillScanResult } from "./skill-scan.js";
import type { CategoryMap } from "./skill-categories-config.js";

export type PointerGenerationResult = {
  pointers: Array<{ category: string; path: string; skillCount: number }>;
  migratedCount: number;
};

function getCategoryTitle(category: string): string {
  return category
    .replace(/^_+/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function uniqueDest(base: string): string {
  if (!existsSync(base)) return base;
  let n = 2;
  while (existsSync(`${base}-${n}`)) {
    n++;
  }
  return `${base}-${n}`;
}

export function generatePointerContent(
  category: string,
  skillCount: number,
  vaultPath: string,
  skills?: SkillInfo[],
): string {
  const title = getCategoryTitle(category);
  const categoryPath = join(vaultPath, category);

  const skillList = skills && skills.length > 0
    ? skills.map((s) => {
        const desc = s.description ? ` — ${s.description}` : "";
        return `- \`${s.dirName}\`${desc}`;
      }).join("\n")
    : undefined;

  const body = skillList
    ? `## Available Skills\n\n${skillList}\n\n### How to Use\n1. When performing a task related to ${category}, first check if one of the following skills matches your need:\n\n${skills!.map((s) => `   - **${s.dirName}**${s.description ? `: ${s.description}` : ""}`).join("\n")}\n\n2. Read the relevant skill: \`read_file ${categoryPath}/${skills![0]!.dirName}/SKILL.md\`\n3. Follow the instructions in the skill file\n\n**Hidden Library Path:** \`${categoryPath}\``
    : `## Instructions\n1. When you need to perform a task related to ${category}, you MUST use your file reading tools (like \`list_dir\` and \`view_file\` or \`read_file\`) to browse the hidden library directory: \`${categoryPath}\`\n2. Locate the specific Markdown files related to the exact sub-task you need.\n3. Read the relevant Markdown file(s) into your context.\n4. Follow the specific instructions and best practices found within those files to complete the user's request.\n\n**Hidden Library Path:** \`${categoryPath}\``;

  return `---
name: ${category}-category-pointer
description: Triggers when encountering any task related to ${category}.
---

# ${title} Capability Library

You have access to ${skillCount} specialized ${title.toLowerCase()} skills on your local filesystem. They are NOT loaded into your context window. Discover them on demand.

${body}

*Reminder: Do not guess best practices. Always consult your local skill files first.*
`;
}

export function runOptimize(
  scanResult: SkillScanResult,
  vaultDir: string,
  dryRun: boolean,
  categoryMap?: CategoryMap,
): PointerGenerationResult {
  const pointers: Array<{ category: string; path: string; skillCount: number }> = [];
  let migratedCount = 0;

  const categorized = categoryMap
    ? applyCategoryMap(scanResult.skills, categoryMap)
    : (() => {
        const m = new Map<string, SkillInfo[]>();
        for (const skill of scanResult.skills) {
          const category = categorizeSkill(skill.dirName);
          const arr = m.get(category) ?? [];
          arr.push({ ...skill, category });
          m.set(category, arr);
        }
        return m;
      })();

  if (!dryRun) {
    mkdirSync(vaultDir, { recursive: true });
  }

  for (const [category, skills] of categorized) {
    if (!dryRun) {
      const catDir = join(vaultDir, category);
      mkdirSync(catDir, { recursive: true });

      for (const skill of skills) {
        const sourceDir = skill.sourceDir;
        const destDir = uniqueDest(join(catDir, skill.dirName));
        if (existsSync(sourceDir) && sourceDir !== destDir) {
          renameSync(sourceDir, destDir);
          migratedCount++;
        }
      }
    } else {
      migratedCount += skills.length;
    }

    const pointerParent = skills[0]?.sourceDir
      ? skills[0].sourceDir.replace(/\/[^/]+$/, "")
      : ".";
    const pointerName = `${category}-category-pointer`;
    const pointerDir = join(pointerParent, pointerName);

    if (dryRun) {
      pointers.push({ category, path: join(pointerDir, "SKILL.md"), skillCount: skills.length });
    } else {
      mkdirSync(pointerDir, { recursive: true });
      const content = generatePointerContent(category, skills.length, vaultDir, skills);
      writeFileSync(join(pointerDir, "SKILL.md"), content, "utf8");
      pointers.push({ category, path: join(pointerDir, "SKILL.md"), skillCount: skills.length });
    }
  }

  return { pointers, migratedCount };
}

export function undoOptimize(
  dirs: string[],
  vaultDir: string,
  dryRun: boolean,
): { restoredCount: number } {
  let restoredCount = 0;

  if (!existsSync(vaultDir)) {
    return { restoredCount: 0 };
  }

  const vaultEntries = readdirSync(vaultDir);
  for (const categoryDir of vaultEntries) {
    const catPath = join(vaultDir, categoryDir);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(catPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) {
      continue;
    }

    const skillDirs = readdirSync(catPath);
    for (const skillName of skillDirs) {
      const sourcePath = join(catPath, skillName);
      try {
        const s = statSync(sourcePath);
        if (!s.isDirectory()) {
          continue;
        }
      } catch {
        continue;
      }

      const destPath = findAvailableDest(skillName, dirs);
      if (dryRun) {
        restoredCount++;
      } else {
        renameSync(sourcePath, destPath);
        restoredCount++;
      }
    }

    if (!dryRun) {
      try {
        const remaining = readdirSync(catPath);
        if (remaining.length === 0) {
          rmSync(catPath, { recursive: true, force: true });
        }
      } catch {
        // ignore cleanup errors
      }
    }
  }

  if (!dryRun) {
    try {
      const vaultRemaining = readdirSync(vaultDir);
      if (vaultRemaining.length === 0) {
        rmSync(vaultDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
  }

  return { restoredCount };
}

function findAvailableDest(skillName: string, dirs: string[]): string {
  for (const dir of dirs) {
    const candidate = join(dir, skillName);
    if (!existsSync(candidate)) {
      return candidate;
    }
  }
  return join(dirs[0] ?? ".", skillName);
}
