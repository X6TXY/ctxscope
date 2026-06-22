import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";

const KNOWN_LOCKFILES: Record<string, string> = {
  "pnpm-lock.yaml": "pnpm",
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "bun.lock": "bun",
  "bun.lockb": "bun",
};

const KNOWN_CONFIG_FILES = [
  "vite.config.ts", "vite.config.js",
  "next.config.ts", "next.config.js", "next.config.mjs",
  "vitest.config.ts", "vitest.config.js",
  "playwright.config.ts", "playwright.config.js",
  "tsconfig.json",
  ".prettierrc", ".prettierrc.json", ".prettierrc.js",
  "eslint.config.js", "eslint.config.ts",
];

export type RepoFacts = {
  packageManager?: string;
  scripts: Record<string, string>;
  packageName?: string;
  bin?: Record<string, string> | string;
  sourceDirectories: string[];
  docsDirectories: string[];
  detectedTools: string[];
  readmeHeadings: string[];
};

export function detectRepoFacts(root: string): RepoFacts {
  const packageJsonPath = resolve(root, "package.json");
  let packageManager: string | undefined;
  let scripts: Record<string, string> = {};
  let packageName: string | undefined;
  let bin: Record<string, string> | string | undefined;

  if (existsSync(packageJsonPath)) {
    const content = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
    packageName = typeof content.name === "string" ? content.name : undefined;
    scripts = typeof content.scripts === "object" && content.scripts !== null
      ? content.scripts as Record<string, string>
      : {};
    bin = content.bin;
  }

  for (const [lockfile, manager] of Object.entries(KNOWN_LOCKFILES)) {
    if (existsSync(resolve(root, lockfile))) {
      if (packageManager && packageManager !== manager) {
        packageManager = undefined;
        break;
      }
      packageManager = manager;
    }
  }

  const sourceDirectories: string[] = [];
  const docsDirectories: string[] = [];
  const detectedTools: string[] = [];

  for (const name of ["src", "lib", "app", "source"]) {
    const dir = resolve(root, name);
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      sourceDirectories.push(name);
    }
  }

  for (const name of ["docs", "documentation", "wiki"]) {
    const dir = resolve(root, name);
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      docsDirectories.push(name);
    }
  }

  for (const configFile of KNOWN_CONFIG_FILES) {
    if (existsSync(resolve(root, configFile))) {
      const tool = configFile.replace(/\.config\..*$/, "").replace(/\..*$/, "");
      if (!detectedTools.includes(tool)) {
        detectedTools.push(tool);
      }
    }
  }

  if (scripts.build) {
    detectedTools.push("build");
  }
  if (scripts.test) {
    detectedTools.push("test");
  }
  if (scripts.lint) {
    detectedTools.push("lint");
  }

  const readmeHeadings: string[] = [];
  for (const readmeName of ["README.md", "Readme.md", "readme.md"]) {
    const readmePath = resolve(root, readmeName);
    if (existsSync(readmePath)) {
      const content = readFileSync(readmePath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
        if (match && match[2]) {
          readmeHeadings.push(match[2].trim());
        }
      }
      break;
    }
  }

  return {
    packageManager,
    scripts,
    packageName,
    bin,
    sourceDirectories,
    docsDirectories,
    detectedTools,
    readmeHeadings,
  };
}
