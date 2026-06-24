import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { categorizeSkill, getAllCategories } from "./skill-categorize.js";
import { loadCategoryMap } from "./skill-categories-config.js";
import type { SkillInfo } from "./skill-scan.js";

const ALL_CATEGORIES = getAllCategories();

export async function promptSkillCategories(
  skills: SkillInfo[],
  cwd: string,
): Promise<boolean> {
  const existing = loadCategoryMap(cwd);
  if (existing) return false;

  const heuristic = new Map<string, SkillInfo[]>();
  for (const skill of skills) {
    const cat = categorizeSkill(skill.dirName);
    const arr = heuristic.get(cat) ?? [];
    arr.push(skill);
    heuristic.set(cat, arr);
  }

  const otherSkills = heuristic.get("other") ?? [];
  if (otherSkills.length === 0) return false;

  const categorized = [...heuristic.entries()].filter(([k]) => k !== "other");

  console.error("");
  console.error(`Found ${skills.length} skills — ${categorized.length > 0 ? categorized.reduce((s, [, v]) => s + v.length, 0) : 0} categorized by heuristic, ${otherSkills.length} need your input.`);
  console.error("");

  const rl = createInterface({ input, output, terminal: true });
  const result: Record<string, string[]> = {};

  for (const [cat, catSkills] of categorized) {
    result[cat] = catSkills.map((s) => s.dirName);
  }

  for (let i = 0; i < otherSkills.length; i++) {
    const skill = otherSkills[i]!;
    const assignment = await askOne(skill, i + 1, otherSkills.length, rl);
    const arr = result[assignment] ?? [];
    arr.push(skill.dirName);
    result[assignment] = arr;
  }

  rl.close();

  console.error("");

  const fs = await import("node:fs");
  const { join } = await import("node:path");
  const configPath = join(cwd, ".ctxscope-categories.json");
  const content = JSON.stringify(result, null, 2) + "\n";
  fs.writeFileSync(configPath, content, "utf8");
  console.error(`Saved ${configPath} for future runs.\n`);

  return true;
}

async function askOne(
  skill: SkillInfo,
  index: number,
  total: number,
  rl: ReturnType<typeof createInterface>,
): Promise<string> {
  const prefix = `[${index}/${total}]`;
  const prompt = `${prefix} ${skill.dirName} (category, ? for list, enter to skip) > `;

  while (true) {
    const answer = (await rl.question(prompt)).trim();

    if (answer === "") {
      return "other";
    }

    if (answer === "?" || answer === "list") {
      printCategories();
      continue;
    }

    const match = resolveCategory(answer);
    if (match) return match;

    console.error(`  No category matches "${answer}". Type ? for list.`);
  }
}

function printCategories(): void {
  const cols = 3;
  const rows = Math.ceil(ALL_CATEGORIES.length / cols);
  console.error("");
  for (let r = 0; r < rows; r++) {
    const parts: string[] = [];
    for (let c = 0; c < cols; c++) {
      const idx = r + c * rows;
      if (idx < ALL_CATEGORIES.length) {
        parts.push(`${String(idx + 1).padEnd(3)} ${ALL_CATEGORIES[idx]!.padEnd(22)}`);
      }
    }
    console.error("  " + parts.join(""));
  }
  console.error("");
}

function resolveCategory(input: string): string | null {
  const num = Number.parseInt(input, 10);
  if (num >= 1 && num <= ALL_CATEGORIES.length) {
    return ALL_CATEGORIES[num - 1]!;
  }

  const lower = input.toLowerCase();
  const exact = ALL_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  const prefix = ALL_CATEGORIES.filter((c) => c.toLowerCase().startsWith(lower));
  if (prefix.length === 1) return prefix[0]!;
  if (prefix.length > 1) {
    console.error(`  Multiple matches: ${prefix.join(", ")}`);
    return null;
  }

  return null;
}
