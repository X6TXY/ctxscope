import { readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const IGNORED_DIRECTORIES = new Set([".git", "dist", "node_modules"]);

export function listFiles(targetPath: string): string[] {
  const absoluteTarget = resolve(targetPath);
  const stat = statSync(absoluteTarget);

  if (stat.isFile()) {
    return [absoluteTarget];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  const files: string[] = [];
  walk(absoluteTarget, files);
  return files.sort((a, b) => relative(process.cwd(), a).localeCompare(relative(process.cwd(), b)));
}

function walk(directory: string, files: string[]): void {
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        walk(absolutePath, files);
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
}
