import { existsSync, statSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { createDiagnostic } from "../diagnostics.js";
import { locationFromOffset } from "../locations.js";
import type { ContextFile, CtxscopeConfig, Diagnostic } from "../types.js";

const PATH_PATTERNS = [
  /(?<![\\/])(?:apps|packages|src|lib|app|tests|test|e2e|docs|source|components|utils|hooks|services|stores|styles|assets|public|scripts|tools|config)\/[^\s"'`)\]}>)]+/gi,
  /(?<![\\/])(?:\.\/|\.\.\/)[^\s"'`)\]}>)]+/gi,
];

const SKIP_DIRECTORIES = new Set([".git", "node_modules", "dist", ".next", ".turbo", "build", "coverage", ".cache"]);

export function collectPathDiagnostics(
  target: string,
  files: ContextFile[],
  config: CtxscopeConfig,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const root = resolve(target);
  const rootStat = statSync(root);
  const scanRoot = rootStat.isDirectory() ? root : dirname(root);

  const existingPaths = collectExistingPaths(scanRoot);

  for (const file of files) {
    if (file.skippedBinary) {
      continue;
    }

    const absolutePath = resolve(scanRoot, file.path);
    let content: string;
    try {
      content = readFileSync(absolutePath, "utf8");
    } catch {
      continue;
    }

    const seen = new Set<string>();

    for (const pattern of PATH_PATTERNS) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(content)) !== null) {
        const rawPath = match[0];
        if (seen.has(rawPath)) {
          continue;
        }
        seen.add(rawPath);

        if (shouldSkipPath(rawPath)) {
          continue;
        }

        const resolvedPath = resolve(scanRoot, rawPath);

        if (!existsSync(resolvedPath)) {
          const loc = locationFromOffset(content, match.index);
          const candidates = findSimilarPaths(rawPath, existingPaths);
          const candidateHint = candidates.length > 0
            ? `\n  Did you mean?\n${candidates.map((c) => `    ${c}`).join("\n")}`
            : "";

          const diagnostic = createDiagnostic({
            code: "CTX103",
            defaultSeverity: "warn",
            path: file.path,
            message: `Referenced path does not exist: ${rawPath}${candidateHint}`,
            line: loc.line,
            column: loc.column,
            recommendation: candidates.length > 0
              ? `Replace with existing path: ${candidates[0]}`
              : "Update the path to point to an existing file or directory",
          }, config);

          if (diagnostic) {
            diagnostics.push(diagnostic);
          }
        }
      }
    }
  }

  return diagnostics;
}

function shouldSkipPath(rawPath: string): boolean {
  const firstSegment = rawPath.split("/")[0] ?? "";

  if (SKIP_DIRECTORIES.has(firstSegment)) {
    return true;
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return true;
  }

  if (/^\/[^/]/.test(rawPath)) {
    return true;
  }

  return false;
}

function collectExistingPaths(root: string): string[] {
  const paths: string[] = [];

  function walk(dir: string, depth: number) {
    if (depth > 4) {
      return;
    }

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry === ".git" || entry === "node_modules" || entry === "dist") {
          continue;
        }

        const fullPath = resolve(dir, entry);
        const relativePath = fullPath.replace(root + "/", "").replace(root, ".");

        paths.push(relativePath);

        const st = statSync(fullPath);
        if (st.isDirectory()) {
          walk(fullPath, depth + 1);
        }
      }
    } catch {
      // skip unreadable directories
    }
  }

  walk(root, 0);
  return paths;
}

function findSimilarPaths(input: string, candidates: string[]): string[] {
  const inputName = basename(input);
  const inputDir = dirname(input).replace(/^\./, "");

  const scored = candidates
    .map((candidate) => ({
      path: candidate,
      score: similarity(input, candidate),
    }))
    .filter((s) => s.score > 0.3)
    .sort((a, b) => b.score - a.score);

  const dirMatch = candidates
    .filter((c) => dirname(c).includes(inputDir) || (inputDir === "." || inputDir === ""))
    .map((c) => ({
      path: c,
      score: similarity(inputName, basename(c)),
    }))
    .filter((s) => s.score > 0.4);

  const combined = [...scored, ...dirMatch]
    .sort((a, b) => b.score - a.score);

  return [...new Set(combined.slice(0, 3).map((s) => s.path))];
}

function similarity(a: string, b: string): number {
  const aParts = a.replace(/^\.\//, "").toLowerCase().split(/[/\\]/);
  const bParts = b.replace(/^\.\//, "").toLowerCase().split(/[/\\]/);

  let matchCount = 0;
  for (const aPart of aParts) {
    for (const bPart of bParts) {
      if (aPart === bPart) {
        matchCount++;
      }
    }
  }

  const maxLen = Math.max(aParts.length, bParts.length);
  if (maxLen === 0) {
    return 1;
  }

  const segmentScore = matchCount / maxLen;
  const leven = levenshteinDistance(
    a.replace(/^\.\//, "").toLowerCase(),
    b.replace(/^\.\//, "").toLowerCase(),
  );
  const levenScore = 1 - leven / Math.max(a.length, b.length);

  return segmentScore * 0.4 + levenScore * 0.6;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 1; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}
