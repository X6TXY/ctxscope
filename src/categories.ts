import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { scanSkillDir } from "./skill-scan.js";
import { getAgentSkillDirs, categorizeSkill } from "./skill-categorize.js";

export function generateCategoriesFile(agent: string): { path: string; skillCount: number } {
  const cwd = process.cwd();
  const dirs = getAgentSkillDirs(agent as any, cwd).filter((d) => existsSync(d));
  const grouped = new Map<string, string[]>();

  for (const dir of dirs) {
    const skills = scanSkillDir(dir);
    for (const skill of skills) {
      const category = categorizeSkill(skill.dirName);
      const arr = grouped.get(category) ?? [];
      if (!arr.includes(skill.dirName)) {
        arr.push(skill.dirName);
      }
      grouped.set(category, arr);
    }
  }

  // Sort fallback category last.
  const sorted = [...grouped.entries()].sort((a, b) => {
    if (a[0] === "other") return 1;
    if (b[0] === "other") return -1;
    return a[0].localeCompare(b[0]);
  });

  const configPath = join(cwd, ".ctxscope-categories.json");
  const content = JSON.stringify(Object.fromEntries(sorted), null, 2) + "\n";

  writeFileSync(configPath, content, "utf8");
  return { path: configPath, skillCount: [...grouped.values()].reduce((s, v) => s + v.length, 0) };
}

export function formatCategoriesResult(result: { path: string; skillCount: number }): string {
  if (result.skillCount === 0) {
    return `Created ${result.path}\nNo skills found. Add skill directories to categorize.`;
  }

  return [
    `Created ${result.path}`,
    `Found ${result.skillCount} skill${result.skillCount === 1 ? "" : "s"}`,
    "",
    "Skills are pre-categorized by heuristic. Edit the file to recategorize, then run: ctxscope optimize",
  ].join("\n");
}
