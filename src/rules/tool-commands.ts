import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { statSync } from "node:fs";
import { createDiagnostic } from "../diagnostics.js";
import { locationFromOffset } from "../locations.js";
import type { ContextFile, CtxscopeConfig, Diagnostic } from "../types.js";
import { detectRepoFacts } from "../repo-facts.js";

const BUILTIN_ALLOWLIST = new Set([
  "git", "node", "npx", "npm", "pnpm", "yarn", "bun",
  "docker", "docker-compose", "docker", "compose",
  "make", "cargo", "rustc", "python", "python3", "pip", "pip3", "poetry",
  "go", "deno",
  "ls", "cat", "cd", "cp", "mv", "rm", "mkdir", "touch",
  "echo", "grep", "sed", "awk", "sort", "wc", "tee", "find", "head", "tail",
  "chmod", "chown", "curl", "wget", "env", "export",
  "which", "type", "file", "du", "df", "ps", "top", "kill",
  "exit", "source", "exec", "time",
  "nano", "vim", "vi", "code", "less", "more",
  "true", "false", "yes", "no",
  "sudo", "su", "ssh", "scp", "rsync",
  "jq", "yq", "rg", "fd", "fzf", "bat",
  "tsx", "ts-node", "esbuild", "vite", "vitest", "playwright",
  "jest", "mocha", "ava", "tap", "uvu",
  "eslint", "prettier", "stylelint",
  "next", "nuxt", "remix",
  "prisma", "drizzle",
  "husky", "lint-staged",
  "turbo", "nx", "lerna",
  "tsc", "tsd", "typedoc",
  "tailwindcss", "postcss",
  "webpack", "rollup", "parcel",
  "swc", "oxc",
  "biome", "rome",
]);

const COMMON_WORDS = new Set([
  "this", "the", "it", "and", "for", "when", "has", "is", "are",
  "all", "any", "not", "also", "how", "what", "which", "by", "to",
  "in", "on", "of", "with", "as", "an", "or", "but", "if", "no",
  "just", "very", "so", "we", "be", "do", "can", "will", "may",
  "than", "then", "that", "there", "their", "they", "have", "been",
  "into", "would", "could", "should", "does", "did", "done", "get",
  "got", "use", "using", "used", "run", "running", "ran", "set",
  "see", "need", "make", "made", "take", "tell", "some", "more",
  "each", "every", "both", "few", "those", "these",
  "his", "her", "its", "our", "your", "my",
  "one", "two", "who", "where", "why", "while",
  "up", "down", "out", "off", "over", "under", "about",
]);

function shouldSkipCommand(cmd: string): boolean {
  if (cmd.length < 2) {
    return true;
  }
  if (cmd.startsWith("-")) {
    return true;
  }
  if (cmd.includes(".")) {
    return true;
  }
  if (cmd.startsWith(">") || cmd.startsWith("|") || cmd.startsWith("&") || cmd.startsWith("$")) {
    return true;
  }
  if (/[>&|]/.test(cmd)) {
    return true;
  }
  if (cmd.includes("`")) {
    return true;
  }
  if (/^["'"]/.test(cmd) || /["'"]$/.test(cmd)) {
    return true;
  }
  if (COMMON_WORDS.has(cmd)) {
    return true;
  }
  return false;
}

export function collectToolCommandDiagnostics(
  target: string,
  files: ContextFile[],
  config: CtxscopeConfig,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const root = resolve(target);
  const rootStat = statSync(root);
  const scanRoot = rootStat.isDirectory() ? root : dirname(root);

  const facts = detectRepoFacts(scanRoot);
  const knownTools = new Set([
    ...facts.detectedTools,
    ...Object.keys(facts.scripts),
    ...BUILTIN_ALLOWLIST,
  ]);

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

    const seenCommands = new Set<string>();
    const commands = extractCommands(content);

    for (const { command, offset } of commands) {
      const cmd = command.toLowerCase().trim();

      if (shouldSkipCommand(cmd)) {
        continue;
      }

      if (seenCommands.has(cmd)) {
        continue;
      }
      seenCommands.add(cmd);

      if (knownTools.has(cmd)) {
        continue;
      }

      if (facts.scripts[cmd]) {
        continue;
      }

      if (isFilePath(cmd)) {
        continue;
      }

      const loc = locationFromOffset(content, offset);

      const diagnostic = createDiagnostic({
        code: "CTX104",
        defaultSeverity: "warn",
        path: file.path,
        message: `Command references "${command}", which is not recognized as a known tool or script`,
        line: loc.line,
        column: loc.column,
        recommendation: facts.detectedTools.length > 0
          ? `Available tools: ${facts.detectedTools.join(", ")}`
          : "Verify the command name or add it to the allowlist",
      }, config);

      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
  }

  return diagnostics;
}

function extractCommands(content: string): { command: string; offset: number }[] {
  const results: { command: string; offset: number }[] = [];

  const codeBlocks = content.matchAll(/```(?:bash|sh|shell|zsh)\s*\n([\s\S]*?)```/gi);
  for (const block of codeBlocks) {
    const blockContent = block[1] ?? "";
    const blockOffset = block.index! + block[0].indexOf(blockContent);

    for (const line of blockContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
        continue;
      }
      const firstWord = trimmed.split(/\s+/)[0]?.replace(/[.,;!?:)]+$/, "");
      if (firstWord) {
        const lineOffset = blockOffset + blockContent.indexOf(line);
        results.push({ command: firstWord, offset: lineOffset });
      }
    }
  }

  const inlineLines = content.matchAll(/(?:^|\n)\s*(?:>\s*|\$+\s+)(.+)$/gm);
  for (const match of inlineLines) {
    const cmdLine = match[1]?.trim();
    if (cmdLine) {
      const firstWord = cmdLine.split(/\s+/)[0]?.replace(/[.,;!?:)]+$/, "");
      if (firstWord) {
        results.push({ command: firstWord, offset: match.index! + match[0].indexOf(match[1]!) });
      }
    }
  }

  const runPattern = /\b(?:run|use|execute)\s+`([^`]+)`/gi;
  for (const match of content.matchAll(runPattern)) {
    const cmdContent = match[1]?.trim();
    if (cmdContent) {
      const words = cmdContent.split(/\s+/);
      if (words.length < 2) {
        continue;
      }
      const firstWord = words[0];
      if (firstWord) {
        results.push({ command: firstWord, offset: match.index! });
      }
    }
  }

  const directPattern = /\b(?:run|use|execute)\s+(\S+)/gi;
  for (const match of content.matchAll(directPattern)) {
    const rawCmd = match[1]?.trim();
    if (rawCmd) {
      if (rawCmd.includes("`")) {
        continue;
      }
      if (isExecPrefix(rawCmd)) {
        continue;
      }
      const clean = rawCmd.replace(/[.,;!?:)]+$/, "");
      if (clean) {
        results.push({ command: clean, offset: match.index! });
      }
    }
  }

  for (const match of content.matchAll(INLINE_COMMAND)) {
    const cmd = match[1] ?? match[2] ?? "";
    if (cmd && !isExecPrefix(cmd)) {
      results.push({ command: cmd, offset: match.index! });
    }
  }

  return results;
}

const INLINE_COMMAND = /\b(pnpm|npm|yarn|bun|npx|node|python|python3|pip|pip3|poetry|go|rustc|cargo|make|docker|git|gh|curl|wget|ls|cat|cp|mv|rm|mkdir|touch|chmod|chown|echo|grep|sed|awk|sort|wc|tee|find|head|tail)\s+([^\s;"'`|&]+)/gi;

function isExecPrefix(cmd: string): boolean {
  return ["run", "use", "execute"].includes(cmd.toLowerCase());
}

function isFilePath(cmd: string): boolean {
  return cmd.includes("/") || cmd.includes("\\") || cmd.startsWith("./") || cmd.startsWith(".");
}
