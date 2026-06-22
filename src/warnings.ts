import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import { firstRegexLocation, locationFromOffset } from "./locations.js";
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
    const location = firstRegexLocation(content, new RegExp(MARKER_PATTERN.source, MARKER_PATTERN.flags));
    pushDiagnostic(diagnostics, createDiagnostic({
      code: "CTX005",
      defaultSeverity: "warn",
      path: file.path,
      message: "contains TODO, FIXME, or obsolete markers",
      line: location?.line,
      column: location?.column,
      recommendation: "remove stale TODO, FIXME, or obsolete instructions from agent context",
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
        line: match.index === undefined ? undefined : locationFromOffset(content, match.index).line,
        column: match.index === undefined ? undefined : locationFromOffset(content, match.index).column,
        recommendation: "remove the stale link or update it to an existing file",
      }, config));
    }
  }

  return diagnostics;
}

function collectRepeatedParagraphDiagnostics(displayPath: string, content: string, config: CtxscopeConfig): Diagnostic[] {
  const paragraphs = collectParagraphs(content);
  const seen = new Set<string>();

  for (const paragraph of paragraphs) {
    if (seen.has(paragraph.normalized)) {
      const location = locationFromOffset(content, paragraph.offset);
      const diagnostic = createDiagnostic({
        code: "CTX006",
        defaultSeverity: "warn",
        path: displayPath,
        message: "contains a repeated paragraph",
        line: location.line,
        column: location.column,
        fix: {
          title: "Remove repeated paragraph",
          kind: "delete",
          safe: true,
        },
      }, config);

      return diagnostic ? [diagnostic] : [];
    }

    seen.add(paragraph.normalized);
  }

  return [];
}

function collectParagraphs(content: string): Array<{ normalized: string; offset: number }> {
  const paragraphs: Array<{ normalized: string; offset: number }> = [];
  const pattern = /(^|\n)([^\S\r\n]*\S[\s\S]*?)(?=\n\s*\n|$)/g;

  for (const match of content.matchAll(pattern)) {
    const raw = match[2] ?? "";
    const trimmedStart = raw.search(/\S/);
    const offset = (match.index ?? 0) + (match[1]?.length ?? 0) + Math.max(trimmedStart, 0);
    const normalized = raw.trim().replace(/\s+/g, " ");

    if (normalized.length >= 40) {
      paragraphs.push({ normalized, offset });
    }
  }

  return paragraphs;
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
