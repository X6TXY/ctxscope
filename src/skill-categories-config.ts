import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillInfo } from "./skill-scan.js";

export type CategoryMap = Record<string, string[]>;

export function loadCategoryMap(cwd: string): CategoryMap | null {
  const paths = [
    join(cwd, ".ctxscope-categories.json"),
    join(cwd, ".ctxscope", "categories.json"),
  ];

  for (const filePath of paths) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf8");
        const parsed = JSON.parse(content) as Record<string, string[]>;
        // Filter to only valid array entries
        const result: CategoryMap = {};
        for (const [category, skills] of Object.entries(parsed)) {
          if (Array.isArray(skills) && skills.length > 0) {
            result[category] = skills;
          }
        }
        return result;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function applyCategoryMap(
  skills: SkillInfo[],
  categoryMap: CategoryMap,
): Map<string, SkillInfo[]> {
  const skillByName = new Map<string, SkillInfo>();
  for (const skill of skills) {
    skillByName.set(skill.dirName, skill);
  }

  const assigned = new Set<string>();
  const categorized = new Map<string, SkillInfo[]>();

  for (const [category, skillNames] of Object.entries(categoryMap)) {
    for (const name of skillNames) {
      const skill = skillByName.get(name);
      if (skill) {
        const arr = categorized.get(category) ?? [];
        arr.push({ ...skill, category });
        categorized.set(category, arr);
        assigned.add(name);
      }
    }
  }

  // Unassigned skills go to the fallback category.
  const unassigned = skills.filter((s) => !assigned.has(s.dirName));
  if (unassigned.length > 0) {
    categorized.set("other", unassigned.map((s) => ({ ...s, category: "other" })));
  }

  return categorized;
}
