import type { Diagnostic, DoctorResult, ScanResult } from "./types.js";

const colorEnabled = process.env.NO_COLOR === undefined && (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);
const colors = {
  bold: (value: string) => color("\u001b[1m", value),
  cyan: (value: string) => color("\u001b[36m", value),
  dim: (value: string) => color("\u001b[2m", value),
  green: (value: string) => color("\u001b[32m", value),
  red: (value: string) => color("\u001b[31m", value),
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

export function formatHumanDoctorResult(result: DoctorResult): string {
  const sections = [
    colors.bold(colors.cyan("ctxscope doctor")),
    formatDoctorMeta(result),
    formatDoctorSummary(result),
    formatDoctorDiagnostics(result),
  ];

  return sections.filter(Boolean).join("\n\n");
}

export function formatJsonDoctorResult(result: DoctorResult): string {
  return JSON.stringify({
    agent: result.agent,
    target: result.target,
    status: result.status,
    summary: result.summary,
    files: result.files,
    diagnostics: result.diagnostics,
  }, null, 2);
}

function formatWarning(warning: Diagnostic): string {
  const severity = colorSeverity(warning);
  const code = warning.severity === "error" ? colors.red(warning.code) : colors.yellow(warning.code);

  return `${severity} ${code}  ${warning.path}\n  ${colors.dim(warning.message)}`;
}

function colorSeverity(diagnostic: Diagnostic): string {
  return diagnostic.severity === "error"
    ? colors.red(diagnostic.severity.toUpperCase())
    : colors.yellow(diagnostic.severity.toUpperCase());
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
  const errors = result.warnings.filter((warning) => warning.severity === "error").length;
  const warnings = result.warnings.filter((warning) => warning.severity === "warn").length;
  const diagnosticLabel = result.warnings.length === 0
    ? colors.green("0 diagnostics")
    : [
      errors > 0 ? colors.red(`${errors} errors`) : null,
      warnings > 0 ? colors.yellow(`${warnings} warnings`) : null,
    ].filter(Boolean).join(", ");

  return `${colors.bold("Summary")}\n  ${formatNumber(result.files.length)} files, ~${formatNumber(result.totalTokens)} tokens, ${diagnosticLabel}`;
}

function formatWarnings(result: ScanResult): string {
  if (result.warnings.length === 0) {
    return "";
  }

  return `${colors.bold("Diagnostics")} ${colors.dim(`(${result.warnings.length})`)}\n${result.warnings.map(formatWarning).join("\n")}`;
}

function formatDoctorMeta(result: DoctorResult): string {
  return [
    `${colors.dim("Agent")}   ${result.agent}`,
    `${colors.dim("Target")}  ${result.target}`,
    `${colors.dim("Status")}  ${result.status === "pass" ? colors.green("pass") : colors.red("fail")}`,
  ].join("\n");
}

function formatDoctorSummary(result: DoctorResult): string {
  const diagnosticLabel = result.diagnostics.length === 0
    ? colors.green("0 diagnostics")
    : [
      result.summary.errors > 0 ? colors.red(`${result.summary.errors} errors`) : null,
      result.summary.warnings > 0 ? colors.yellow(`${result.summary.warnings} warnings`) : null,
    ].filter(Boolean).join(", ");

  return `${colors.bold("Summary")}\n  ${formatNumber(result.summary.files)} files, ~${formatNumber(result.summary.totalTokens)} tokens, ${diagnosticLabel}`;
}

function formatDoctorDiagnostics(result: DoctorResult): string {
  if (result.diagnostics.length === 0) {
    return "";
  }

  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === "warn");
  const sections: string[] = [];

  if (errors.length > 0) {
    sections.push(`${colors.bold("Errors")} ${colors.dim(`(${errors.length})`)}\n${errors.map(formatWarning).join("\n")}`);
  }

  if (warnings.length > 0) {
    sections.push(`${colors.bold("Warnings")} ${colors.dim(`(${warnings.length})`)}\n${warnings.map(formatWarning).join("\n")}`);
  }

  return sections.join("\n\n");
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
