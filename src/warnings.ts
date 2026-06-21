import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { ContextFile, Warning } from "./types.js";

const OVERSIZED_TOKEN_LIMIT = 2500;
const MARKER_PATTERN = /\b(TODO|FIXME|OBSOLETE)\b/i;
const MARKDOWN_LINK_PATTERN = /(?<!!)\[[^\]\n]+\]\(([^)]+)\)/g;

type WarningInput = {
  absolutePath: string;
  file: ContextFile;
};

export function collectWarnings(files: WarningInput[]): Warning[] {
  const warnings: Warning[] = [];
  const headings = new Map<string, string[]>();

  for (const input of files) {
    warnings.push(...collectFileWarnings(input));
    collectHeadings(input, headings);
  }

  warnings.push(...collectDuplicateHeadingWarnings(headings));

  return warnings.sort((a, b) => {
    const pathComparison = a.path.localeCompare(b.path);
    return pathComparison === 0 ? a.code.localeCompare(b.code) : pathComparison;
  });
}

function collectFileWarnings(input: WarningInput): Warning[] {
  const warnings: Warning[] = [];
  const { file } = input;

  if (file.skippedBinary) {
    return warnings;
  }

  const content = readFileSync(input.absolutePath, "utf8");

  if (file.tokens > OVERSIZED_TOKEN_LIMIT) {
    warnings.push({
      code: "CTX001",
      severity: "warn",
      path: file.path,
      message: `larger than ${OVERSIZED_TOKEN_LIMIT} estimated tokens`,
    });
  }

  if (content.trim().length === 0) {
    warnings.push({
      code: "CTX004",
      severity: "warn",
      path: file.path,
      message: "empty context file",
    });
  }

  if (MARKER_PATTERN.test(content)) {
    warnings.push({
      code: "CTX005",
      severity: "warn",
      path: file.path,
      message: "contains TODO, FIXME, or obsolete markers",
    });
  }

  warnings.push(...collectStaleLinkWarnings(input.absolutePath, file.path, content));
  warnings.push(...collectRepeatedParagraphWarnings(file.path, content));

  return warnings;
}

function collectHeadings(input: WarningInput, headings: Map<string, string[]>): void {
  if (input.file.skippedBinary) {
    return;
  }

  const content = readFileSync(input.absolutePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const heading = match[2]?.trim().toLowerCase();
    if (!heading) {
      continue;
    }

    const paths = headings.get(heading) ?? [];
    paths.push(input.file.path);
    headings.set(heading, paths);
  }
}

function collectDuplicateHeadingWarnings(headings: Map<string, string[]>): Warning[] {
  const warnings: Warning[] = [];

  for (const [heading, paths] of headings.entries()) {
    const uniquePaths = [...new Set(paths)];
    if (uniquePaths.length < 2) {
      continue;
    }

    for (const path of uniquePaths) {
      warnings.push({
        code: "CTX002",
        severity: "warn",
        path,
        message: `heading "${heading}" appears in ${uniquePaths.length} context files`,
      });
    }
  }

  return warnings;
}

function collectStaleLinkWarnings(absolutePath: string, displayPath: string, content: string): Warning[] {
  const warnings: Warning[] = [];
  const directory = dirname(absolutePath);

  for (const match of content.matchAll(MARKDOWN_LINK_PATTERN)) {
    const href = match[1]?.trim();
    if (!href || shouldSkipLink(href)) {
      continue;
    }

    const pathOnly = href.split("#")[0]?.split("?")[0] ?? "";
    if (!pathOnly || !existsSync(resolve(directory, pathOnly))) {
      warnings.push({
        code: "CTX003",
        severity: "warn",
        path: displayPath,
        message: `links to missing file: ${href}`,
      });
    }
  }

  return warnings;
}

function collectRepeatedParagraphWarnings(displayPath: string, content: string): Warning[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim().replace(/\s+/g, " "))
    .filter((paragraph) => paragraph.length >= 40);
  const seen = new Set<string>();

  for (const paragraph of paragraphs) {
    if (seen.has(paragraph)) {
      return [{
        code: "CTX006",
        severity: "warn",
        path: displayPath,
        message: "contains a repeated paragraph",
      }];
    }

    seen.add(paragraph);
  }

  return [];
}

function shouldSkipLink(href: string): boolean {
  return href.startsWith("http://")
    || href.startsWith("https://")
    || href.startsWith("mailto:")
    || href.startsWith("#");
}
