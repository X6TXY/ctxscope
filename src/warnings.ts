import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import type { ContextFile, CtxscopeConfig, Diagnostic } from "./types.js";

const MARKER_PATTERN = /\b(TODO|FIXME|OBSOLETE)\b/i;
const MARKDOWN_LINK_PATTERN = /(?<!!)\[[^\]\n]+\]\(([^)]+)\)/g;

type WarningInput = {
  absolutePath: string;
  file: ContextFile;
};

export function collectDiagnostics(files: WarningInput[], config: CtxscopeConfig): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const headings = new Map<string, string[]>();

  for (const input of files) {
    diagnostics.push(...collectFileDiagnostics(input, config));
    collectHeadings(input, headings);
  }

  diagnostics.push(...collectDuplicateHeadingDiagnostics(headings, config));

  return sortDiagnostics(diagnostics);
}

function collectFileDiagnostics(input: WarningInput, config: CtxscopeConfig): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { file } = input;

  if (file.skippedBinary) {
    return diagnostics;
  }

  const content = readFileSync(input.absolutePath, "utf8");

  if (file.tokens > config.maxFileTokens) {
    pushDiagnostic(diagnostics, createDiagnostic({
      code: "CTX001",
      defaultSeverity: "warn",
      path: file.path,
      message: `larger than ${config.maxFileTokens} estimated tokens`,
    }, config));
  }

  if (content.trim().length === 0) {
    pushDiagnostic(diagnostics, createDiagnostic({
      code: "CTX004",
      defaultSeverity: "warn",
      path: file.path,
      message: "empty context file",
    }, config));
  }

  if (MARKER_PATTERN.test(content)) {
    pushDiagnostic(diagnostics, createDiagnostic({
      code: "CTX005",
      defaultSeverity: "warn",
      path: file.path,
      message: "contains TODO, FIXME, or obsolete markers",
    }, config));
  }

  diagnostics.push(...collectStaleLinkDiagnostics(input.absolutePath, file.path, content, config));
  diagnostics.push(...collectRepeatedParagraphDiagnostics(file.path, content, config));

  return diagnostics;
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

function collectDuplicateHeadingDiagnostics(headings: Map<string, string[]>, config: CtxscopeConfig): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [heading, paths] of headings.entries()) {
    const uniquePaths = [...new Set(paths)];
    if (uniquePaths.length < 2) {
      continue;
    }

    for (const path of uniquePaths) {
      pushDiagnostic(diagnostics, createDiagnostic({
        code: "CTX002",
        defaultSeverity: "warn",
        path,
        message: `heading "${heading}" appears in ${uniquePaths.length} context files`,
      }, config));
    }
  }

  return diagnostics;
}

function collectStaleLinkDiagnostics(absolutePath: string, displayPath: string, content: string, config: CtxscopeConfig): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const directory = dirname(absolutePath);

  for (const match of content.matchAll(MARKDOWN_LINK_PATTERN)) {
    const href = match[1]?.trim();
    if (!href || shouldSkipLink(href)) {
      continue;
    }

    const pathOnly = href.split("#")[0]?.split("?")[0] ?? "";
    if (!pathOnly || !existsSync(resolve(directory, pathOnly))) {
      pushDiagnostic(diagnostics, createDiagnostic({
        code: "CTX003",
        defaultSeverity: "warn",
        path: displayPath,
        message: `links to missing file: ${href}`,
      }, config));
    }
  }

  return diagnostics;
}

function collectRepeatedParagraphDiagnostics(displayPath: string, content: string, config: CtxscopeConfig): Diagnostic[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim().replace(/\s+/g, " "))
    .filter((paragraph) => paragraph.length >= 40);
  const seen = new Set<string>();

  for (const paragraph of paragraphs) {
    if (seen.has(paragraph)) {
      const diagnostic = createDiagnostic({
        code: "CTX006",
        defaultSeverity: "warn",
        path: displayPath,
        message: "contains a repeated paragraph",
      }, config);

      return diagnostic ? [diagnostic] : [];
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

function pushDiagnostic(diagnostics: Diagnostic[], diagnostic: Diagnostic | null): void {
  if (diagnostic) {
    diagnostics.push(diagnostic);
  }
}
