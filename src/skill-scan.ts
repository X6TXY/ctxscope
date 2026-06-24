import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type SkillInfo = {
  dirName: string;
  name: string;
  description: string;
  path: string;
  sourceDir: string;
  category: string;
  descriptionTokens: number;
};

export type SkillScanResult = {
  skills: SkillInfo[];
  totalTokenCost: number;
  dirBreakdown: Array<{ dir: string; skillCount: number; tokenCost: number }>;
};

function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { name: "", description: "" };
  }

  const frontmatter = match[1] ?? "";
  let name = "";
  let description = "";

  for (const line of frontmatter.split("\n")) {
    if (line.startsWith("name:")) {
      name = line.slice("name:".length).trim().replace(/^["']|["']$/g, "");
    } else if (line.startsWith("description:")) {
      description = line.slice("description:".length).trim().replace(/^["']|["']$/g, "");
    }
  }

  return { name, description };
}

export function scanSkillDir(dir: string): SkillInfo[] {
  const results: SkillInfo[] = [];

  if (!existsSync(dir)) {
    return results;
  }

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const skillDir = join(dir, entry);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(skillDir);
    } catch {
      continue;
    }

    if (!stat.isDirectory()) {
      continue;
    }

    if (entry.endsWith("-category-pointer")) {
      continue;
    }

    const skillMdPath = join(skillDir, "SKILL.md");
    if (!existsSync(skillMdPath)) {
      continue;
    }

    let content: string;
    try {
      content = readFileSync(skillMdPath, "utf8");
    } catch {
      continue;
    }

    const { name, description } = parseFrontmatter(content);
    const combinedTokens = countTokens(name) + countTokens(description);

    results.push({
      dirName: entry,
      name: name || entry,
      description,
      path: skillMdPath,
      sourceDir: skillDir,
      category: "",
      descriptionTokens: combinedTokens,
    });
  }

  return results;
}

export function scanSkillDirs(dirs: string[]): SkillScanResult {
  const allSkills: SkillInfo[] = [];
  const dirBreakdown: Array<{ dir: string; skillCount: number; tokenCost: number }> = [];
  let totalTokenCost = 0;

  for (const dir of dirs) {
    const skills = scanSkillDir(dir);
    const dirTokenCost = skills.reduce((sum, s) => sum + s.descriptionTokens, 0);
    allSkills.push(...skills);
    totalTokenCost += dirTokenCost;
    dirBreakdown.push({ dir, skillCount: skills.length, tokenCost: dirTokenCost });
  }

  return { skills: allSkills, totalTokenCost, dirBreakdown };
}
