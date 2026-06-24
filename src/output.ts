import type { Diagnostic, DoctorResult, ScanResult, ContextScore } from "./types.js";
import type { FixResult, FixDiff } from "./fix.js";
import type { RuleExplanation } from "./explain.js";

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

export function formatHumanDoctorResult(result: DoctorResult, verbose?: boolean): string {
  const sections = [
    colors.bold(colors.cyan("ctxscope doctor")),
    formatDoctorMeta(result),
    verbose ? formatVerboseScore(result) : formatDoctorScore(result),
    formatDoctorSummary(result),
    formatDoctorDiagnostics(result),
  ];

  return sections.filter(Boolean).join("\n\n");
}

function formatVerboseScore(result: DoctorResult): string {
  const score = result.score;
  const breakdown = result.scoreBreakdown;

  const penaltyLine = (category: Exclude<keyof ContextScore, "overall">): string[] => {
    const item = breakdown[category];
    const title = category.charAt(0).toUpperCase() + category.slice(1);
    const lines = item.penalties.map((penalty) => {
      const count = penalty.count > 1 ? ` x${penalty.count}` : "";
      return `    ${colors.dim(`-${penalty.deduction}`)}  ${penalty.code}${count}  ${penalty.message}`;
    });

    return [`  ${title}  ${scoreColor(item.score)(`${item.score}/100`)}`, ...lines];
  };

  return [
    `${colors.bold("Agent Context Score")}  ${scoreColor(score.overall)(`${score.overall}/100`)}`,
    ...penaltyLine("correctness"),
    ...penaltyLine("freshness"),
    ...penaltyLine("efficiency"),
    ...penaltyLine("consistency"),
    ...penaltyLine("coverage"),
  ].join("\n");
}

export function formatJsonDoctorResult(result: DoctorResult): string {
  return JSON.stringify({
    agent: result.agent,
    target: result.target,
    status: result.status,
    summary: result.summary,
    score: result.score,
    scoreBreakdown: result.scoreBreakdown,
    files: result.files,
    diagnostics: result.diagnostics,
  }, null, 2);
}

export function formatHumanFixResult(result: FixResult, diffs?: FixDiff[]): string {
  const sections = [
    colors.bold(colors.cyan("ctxscope fix")),
    formatFixMeta(result),
    formatFixSummary(result),
    ...(diffs && diffs.length > 0 ? diffs.map(formatFixDiff) : []),
    formatAppliedFixes(result),
    formatSkippedFixes(result),
  ];

  return sections.filter(Boolean).join("\n\n");
}

function formatFixDiff(diff: FixDiff): string {
  const lines = [
    "",
    `${colors.bold("Diff")}  ${diff.path}`,
    colors.dim("--- a/" + diff.path),
    colors.dim("+++ b/" + diff.path),
  ];

  for (const line of diff.diff.split("\n")) {
    if (line.startsWith("+")) {
      lines.push(colors.green(line));
    } else if (line.startsWith("-")) {
      lines.push(colors.red(line));
    } else if (line.startsWith("@@")) {
      lines.push(colors.cyan(line));
    } else {
      lines.push(line);
    }
  }

  return lines.join("\n");
}

export function formatJsonFixResult(result: FixResult): string {
  return JSON.stringify({
    target: result.target,
    applied: result.applied,
    skipped: result.skipped,
    before: result.before,
    after: result.after,
  }, null, 2);
}

function formatWarning(warning: Diagnostic): string {
  const severity = colorSeverity(warning);
  const code = warning.severity === "error" ? colors.red(warning.code) : colors.yellow(warning.code);
  const location = warning.line === undefined ? warning.path : `${warning.path}:${warning.line}`;
  const details = [colors.dim(warning.message)];

  if (warning.fix?.safe) {
    details.push(`${colors.dim("Fix:")} ${warning.fix.title}`);
  } else if (warning.recommendation) {
    details.push(`${colors.dim("Recommendation:")} ${warning.recommendation}`);
  }

  return `${severity} ${code}  ${location}\n  ${details.join("\n  ")}`;
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

  const safeFixes = result.diagnostics.filter((diagnostic) => diagnostic.fix?.safe).length;
  const fixLine = safeFixes > 0 ? `\n  Run ctxscope fix to apply ${safeFixes} safe ${safeFixes === 1 ? "fix" : "fixes"}.` : "";

  return `${colors.bold("Summary")}\n  ${formatNumber(result.summary.files)} files, ~${formatNumber(result.summary.totalTokens)} tokens, ${diagnosticLabel}${fixLine}`;
}

function formatDoctorScore(result: DoctorResult): string {
  return [
    `${colors.bold("Agent Context Score")}  ${scoreColor(result.score.overall)(`${result.score.overall}/100`)}`,
    `  Correctness  ${scoreColor(result.score.correctness)(String(result.score.correctness))}`,
    `  Freshness    ${scoreColor(result.score.freshness)(String(result.score.freshness))}`,
    `  Efficiency   ${scoreColor(result.score.efficiency)(String(result.score.efficiency))}`,
    `  Consistency  ${scoreColor(result.score.consistency)(String(result.score.consistency))}`,
    `  Coverage     ${scoreColor(result.score.coverage)(String(result.score.coverage))}`,
  ].join("\n");
}

function scoreColor(score: number): (value: string) => string {
  if (score >= 80) {
    return colors.green;
  }

  if (score >= 60) {
    return colors.yellow;
  }

  return colors.red;
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

function formatFixMeta(result: FixResult): string {
  const dryRun = result.applied.some((fix) => fix.dryRun);
  return [
    `${colors.dim("Target")}  ${result.target}`,
    `${colors.dim("Mode")}    ${dryRun ? "dry-run" : "write"}`,
  ].join("\n");
}

function formatFixSummary(result: FixResult): string {
  const beforeScore = result.before.score.overall;
  const afterScore = result.after.score.overall;
  const beforeTokens = result.before.summary.totalTokens;
  const afterTokens = result.after.summary.totalTokens;
  const savedTokens = Math.max(0, beforeTokens - afterTokens);
  const action = result.applied.some((fix) => fix.dryRun) ? "Would apply" : "Applied";

  return [
    `${colors.bold("Summary")}`,
    `  Agent Context Score  ${scoreColor(afterScore)(`${beforeScore} -> ${afterScore}`)}`,
    `  ${action} ${result.applied.length} safe ${result.applied.length === 1 ? "fix" : "fixes"}`,
    `  Skipped ${result.skipped.length} ${result.skipped.length === 1 ? "fix" : "fixes"}`,
    `  Saved ~${formatNumber(savedTokens)} tokens per session`,
  ].join("\n");
}

function formatAppliedFixes(result: FixResult): string {
  if (result.applied.length === 0) {
    return "";
  }

  return `${colors.bold(result.applied.some((fix) => fix.dryRun) ? "Would Apply" : "Applied")} ${colors.dim(`(${result.applied.length})`)}\n${result.applied
    .map((fix) => `${fix.code}  ${fix.path}\n  ${colors.dim(fix.title)}`)
    .join("\n")}`;
}

function formatSkippedFixes(result: FixResult): string {
  if (result.skipped.length === 0) {
    return "";
  }

  return `${colors.bold("Skipped")} ${colors.dim(`(${result.skipped.length})`)}\n${result.skipped
    .map((fix) => `${fix.code}  ${fix.path}\n  ${colors.dim(`${fix.title}: ${fix.reason}`)}`)
    .join("\n")}`;
}

export function formatHumanExplainResult(explanation: RuleExplanation): string {
  const severity = explanation.severity === "error"
    ? colors.red(explanation.severity.toUpperCase())
    : colors.yellow(explanation.severity.toUpperCase());
  const fix = explanation.safeAutofix
    ? `  ${colors.dim("Autofix:")} yes (run ctxscope fix)`
    : `  ${colors.dim("Autofix:")} no`;

  return [
    `${colors.bold(explanation.code)}: ${explanation.title}`,
    `  ${colors.dim("Severity:")} ${severity}`,
    `  ${colors.dim("Problem:")} ${explanation.problem}`,
    `  ${colors.dim("Why:")} ${explanation.whyItMatters}`,
    `  ${colors.dim("Fix:")} ${explanation.fix}`,
    fix,
  ].join("\n");
}

export function formatJsonExplainResult(explanation: RuleExplanation): string {
  return JSON.stringify(explanation, null, 2);
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
