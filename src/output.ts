import type { ScanResult } from "./types.js";

const colorEnabled = process.env.NO_COLOR === undefined && (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);
const colors = {
  bold: (value: string) => color("\u001b[1m", value),
  cyan: (value: string) => color("\u001b[36m", value),
  dim: (value: string) => color("\u001b[2m", value),
  green: (value: string) => color("\u001b[32m", value),
  yellow: (value: string) => color("\u001b[33m", value),
};

export function formatHumanScanResult(result: ScanResult): string {
  const sections = [
    colors.bold(colors.cyan("ctxscope scan")),
    formatMeta(result),
    formatFiles(result),
    formatSummary(result),
    formatWarnings(result),
  ];

  return sections.filter(Boolean).join("\n\n");
}

export function formatJsonScanResult(result: ScanResult): string {
  return JSON.stringify({
    agent: result.agent,
    target: result.target,
    files: result.files,
    totalTokens: result.totalTokens,
    warnings: result.warnings,
  }, null, 2);
}

function formatWarning(warning: ScanResult["warnings"][number]): string {
  return `${colors.yellow(warning.severity.toUpperCase())} ${colors.yellow(warning.code)}  ${warning.path}\n  ${colors.dim(warning.message)}`;
}

function formatMeta(result: ScanResult): string {
  return [
    `${colors.dim("Agent")}   ${result.agent}`,
    `${colors.dim("Target")}  ${result.target}`,
  ].join("\n");
}

function formatFiles(result: ScanResult): string {
  if (result.files.length === 0) {
    return `${colors.bold("Files")} ${colors.dim("(0)")}\n  No context files found.`;
  }

  const pathWidth = Math.max("Path".length, ...result.files.map((file) => file.path.length));
  const tokenWidth = Math.max("Tokens".length, ...result.files.map((file) => formatTokenCell(file.tokens, file.skippedBinary).length));
  const header = [
    colors.dim("Path".padEnd(pathWidth)),
    colors.dim("Tokens".padStart(tokenWidth)),
    colors.dim("Agents"),
  ].join("  ");
  const rows = result.files.map((file) => [
    file.path.padEnd(pathWidth),
    formatTokenCell(file.tokens, file.skippedBinary).padStart(tokenWidth),
    file.agents.join(", "),
  ].join("  "));

  return `${colors.bold("Files")} ${colors.dim(`(${result.files.length})`)}\n${header}\n${rows.join("\n")}`;
}

function formatSummary(result: ScanResult): string {
  const warningLabel = result.warnings.length === 0
    ? colors.green("0 warnings")
    : colors.yellow(`${result.warnings.length} warnings`);

  return `${colors.bold("Summary")}\n  ${formatNumber(result.files.length)} files, ~${formatNumber(result.totalTokens)} tokens, ${warningLabel}`;
}

function formatWarnings(result: ScanResult): string {
  if (result.warnings.length === 0) {
    return "";
  }

  return `${colors.bold("Warnings")} ${colors.dim(`(${result.warnings.length})`)}\n${result.warnings.map(formatWarning).join("\n")}`;
}

function formatTokenCell(tokens: number, skippedBinary: boolean): string {
  return skippedBinary ? "binary" : `~${formatNumber(tokens)}`;
}

function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function color(code: string, value: string): string {
  return colorEnabled ? `${code}${value}\u001b[0m` : value;
}
