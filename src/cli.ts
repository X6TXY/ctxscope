#!/usr/bin/env node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { ConfigError, loadConfig } from "./config.js";
import { runDoctor } from "./doctor.js";
import { runFix } from "./fix.js";
import { getExplanationOrThrow } from "./explain.js";
import { generateInstructions, formatGenerateResultHuman, getAgentPath, type AgentTarget } from "./generate.js";
import { InitError, initConfig } from "./init.js";
import { formatHumanDoctorResult, formatHumanExplainResult, formatHumanFixResult, formatHumanScanResult, formatJsonDoctorResult, formatJsonExplainResult, formatJsonFixResult, formatJsonScanResult } from "./output.js";
import { detectRepoFacts } from "./repo-facts.js";
import { detectRepoFactsAtRef, computeRepoFactsDelta, formatDeltaHuman } from "./repo-facts-diff.js";
import { generateCompletion, type Shell } from "./completion.js";
import { scanContext } from "./scan.js";
import { SUPPORTED_AGENTS, type Agent } from "./types.js";
import { isGitRepo, getChangedFiles, listFilesAtRef, getFileContentAtRef } from "./git.js";

type ScanOptions = {
  agent: Agent;
  json: boolean;
  target: string;
};

type DoctorOptions = {
  agent: Agent;
  ci: boolean;
  json: boolean;
  verbose: boolean;
  changed: boolean;
  diffBase: string | undefined;
  target: string;
};

type FixOptions = {
  agent: Agent;
  dryRun: boolean;
  json: boolean;
  target: string;
};

function getVersion(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: string };

    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printHelp(): void {
  console.log(`ctxscope ${getVersion()}

Inspect and lint coding-agent context files.

Usage:
  ctxscope --help
  ctxscope --version
  ctxscope init [--config|--agent <agent>]
  ctxscope scan [path] [--agent <agent>] [--json]
  ctxscope doctor [path] [--agent <agent>] [--json] [--ci] [--verbose] [--changed] [--diff <base>]
  ctxscope fix [path] [--agent <agent>] [--dry-run] [--json]
  ctxscope explain <code> [--json]
  ctxscope generate --agent <agent> [path] [--dry-run] [--force]
  ctxscope top [path] [--agent <agent>] [--json]
  ctxscope cost [path] [--agent <agent>] [--json]
  ctxscope completion <shell>

Commands:
  init                 Create ctxscope.config.json (use --agent to generate instructions).
  scan                 Discover coding-agent context files for a path.
  doctor               Lint coding-agent context files.
  fix                  Apply safe deterministic context fixes.
  explain              Explain a diagnostic code.
  generate             Generate deterministic agent instructions.
  top                  Show largest context files.
  cost                 Show context token overhead.
  completion           Generate shell completion script (zsh, bash, fish).

Options:
  --agent <agent>      Agent profile: all, codex, opencode, claude, generic.
                       Default: all.
  --json               Print machine-readable JSON.
   --ci                 Exit 1 when doctor finds errors.
   --verbose            Show detailed score breakdown (doctor only).
   --dry-run            Show fixes without writing files.
   --force              Overwrite existing files (used with generate/init --agent).
   -h, --help           Show this help message.
   -v, --version        Show the package version.
`);
}

function fail(message: string): never {
  console.error(`ctxscope: ${message}`);
  console.error("Run `ctxscope --help` for usage.");
  process.exit(1);
}

function parseAgent(value: string | undefined): Agent {
  if (!value) {
    fail("missing value for --agent");
  }

  if (!SUPPORTED_AGENTS.includes(value as Agent)) {
    fail(`unsupported agent '${value}'. Expected one of: ${SUPPORTED_AGENTS.join(", ")}`);
  }

  return value as Agent;
}

function parseScanOptions(args: string[]): ScanOptions {
  const options: ScanOptions = {
    agent: "all",
    json: false,
    target: ".",
  };

  let targetSet = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--agent") {
      options.agent = parseAgent(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--agent=")) {
      options.agent = parseAgent(arg.slice("--agent=".length));
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`unknown option '${arg}'`);
    }

    if (targetSet) {
      fail(`unexpected extra path '${arg}'`);
    }

    options.target = arg;
    targetSet = true;
  }

  return options;
}

function parseDoctorOptions(args: string[]): DoctorOptions {
  const options: DoctorOptions = {
    agent: "all",
    ci: false,
    json: false,
    verbose: false,
    changed: false,
    diffBase: undefined,
    target: ".",
  };

  let targetSet = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--ci") {
      options.ci = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    if (arg === "--changed") {
      options.changed = true;
      continue;
    }

    if (arg === "--diff") {
      options.diffBase = args[index + 1];
      if (!options.diffBase || options.diffBase.startsWith("-")) {
        fail("missing value for --diff. Usage: ctxscope doctor --diff main");
      }
      index += 1;
      continue;
    }

    if (arg === "--agent") {
      options.agent = parseAgent(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--agent=")) {
      options.agent = parseAgent(arg.slice("--agent=".length));
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`unknown option '${arg}'`);
    }

    if (targetSet) {
      fail(`unexpected extra path '${arg}'`);
    }

    options.target = arg;
    targetSet = true;
  }

  return options;
}

function parseFixOptions(args: string[]): FixOptions {
  const options: FixOptions = {
    agent: "all",
    dryRun: false,
    json: false,
    target: ".",
  };

  let targetSet = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--agent") {
      options.agent = parseAgent(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--agent=")) {
      options.agent = parseAgent(arg.slice("--agent=".length));
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`unknown option '${arg}'`);
    }

    if (targetSet) {
      fail(`unexpected extra path '${arg}'`);
    }

    options.target = arg;
    targetSet = true;
  }

  return options;
}

function runScan(options: ScanOptions): void {
  const config = loadConfig();
  const result = scanContext(options.target, options.agent, config);

  if (options.json) {
    console.log(formatJsonScanResult(result));
    return;
  }

  console.log(formatHumanScanResult(result));
}

function runDoctorCommand(options: DoctorOptions): void {
  const config = loadConfig();

  if (options.changed) {
    runDoctorChanged(options, config);
    return;
  }

  if (options.diffBase) {
    runDoctorDiff(options, config);
    return;
  }

  const result = runDoctor(options.target, options.agent, config);

  if (options.json) {
    console.log(formatJsonDoctorResult(result));
  } else {
    console.log(formatHumanDoctorResult(result, options.verbose));
  }

  if (options.ci && result.status === "fail") {
    process.exit(1);
  }
}

function runDoctorChanged(options: DoctorOptions, config: import("./types.js").CtxscopeConfig): void {
  if (!isGitRepo(process.cwd())) {
    fail("doctor --changed requires a git repository");
  }

  const result = runDoctor(options.target, options.agent, config);
  const changed = getChangedFiles(process.cwd());
  const changedPaths = new Set(changed.map((f) => f.path));

  const relevantDiagnostics = result.diagnostics.filter((d) => changedPaths.has(d.path));
  const changedResult = {
    ...result,
    diagnostics: relevantDiagnostics.length > 0 ? relevantDiagnostics : result.diagnostics,
  };

  const currentFacts = detectRepoFacts(process.cwd());
  const previousFacts = detectRepoFactsAtRef(process.cwd(), "HEAD");
  const delta = computeRepoFactsDelta(currentFacts, previousFacts);

  const dim = (value: string) => value;

  if (options.json) {
    console.log(formatJsonDoctorResult(changedResult));
  } else {
    console.log("Changed Context Check");
    console.log("");

    const changedList = changed.map((f) => `  ${f.path}`);
    console.log(`${changed.length} changed file${changed.length === 1 ? "" : "s"} affect agent context:`);
    console.log(changedList.join("\n"));

    if (delta.hasChanges) {
      console.log("");
      console.log("Repository facts affected:");
      console.log(formatDeltaHuman(delta));
    }

    console.log("");
    console.log("Diagnostics:");
    console.log(`  ${relevantDiagnostics.length} new`);
    console.log(`  ${changedResult.diagnostics.length < result.diagnostics.length ? "1+" : "0"} resolved`);
    console.log("");
    console.log(formatHumanDoctorResult(changedResult, options.verbose));
  }

  if (options.ci && changedResult.status === "fail") {
    process.exit(1);
  }
}

function runDoctorDiff(options: DoctorOptions, config: import("./types.js").CtxscopeConfig): void {
  if (!isGitRepo(process.cwd())) {
    fail("doctor --diff requires a git repository");
  }

  const baseRef = options.diffBase!;
  const root = resolve(options.target);

  const baseFiles = listFilesAtRef(baseRef, root);
  const tempDir = mkdtempSync(join(tmpdir(), "ctxscope-diff-"));

  try {
    for (const filePath of baseFiles) {
      const content = getFileContentAtRef(baseRef, filePath, root);
      if (content !== null) {
        const absPath = join(tempDir, filePath);
        mkdirSync(join(tempDir, filePath.split("/").slice(0, -1).join("/")), { recursive: true });
        writeFileSync(absPath, content, "utf8");
      }
    }

    const baseResult = runDoctor(tempDir, options.agent, config);
    const currentResult = runDoctor(options.target, options.agent, config);

    const key = (d: import("./types.js").Diagnostic) => `${d.code}:${d.path}:${d.message}`;
    const baseKeys = new Set(baseResult.diagnostics.map(key));
    const currentKeys = new Set(currentResult.diagnostics.map(key));

    const newDiagnostics = currentResult.diagnostics.filter((d) => !baseKeys.has(key(d)));
    const fixedDiagnostics = baseResult.diagnostics.filter((d) => !currentKeys.has(key(d)));

    if (options.json) {
      console.log(JSON.stringify({
        base: {
          score: baseResult.score,
          tokens: baseResult.summary.totalTokens,
          diagnostics: baseResult.diagnostics,
        },
        current: {
          score: currentResult.score,
          tokens: currentResult.summary.totalTokens,
          diagnostics: currentResult.diagnostics,
        },
        newDiagnostics,
        fixedDiagnostics,
      }, null, 2));
    } else {
      const scoreDiff = currentResult.score.overall - baseResult.score.overall;
      const tokenDiff = currentResult.summary.totalTokens - baseResult.summary.totalTokens;
      const scoreStr = scoreDiff >= 0 ? `+${scoreDiff}` : `${scoreDiff}`;
      const tokenStr = tokenDiff >= 0 ? `+${tokenDiff}` : `${tokenDiff}`;

      const lines = [
        "Context Diff",
        "",
        `Score: ${baseResult.score.overall} -> ${currentResult.score.overall} (${scoreStr})`,
        `Tokens: ~${baseResult.summary.totalTokens} -> ~${currentResult.summary.totalTokens} (${tokenStr})`,
      ];

      if (newDiagnostics.length > 0) {
        lines.push("");
        lines.push("New problems:");
        for (const d of newDiagnostics) {
          lines.push(`  ${d.severity.toUpperCase()} ${d.code} ${d.path}${d.line ? `:${d.line}` : ""}`);
          lines.push(`    ${d.message}`);
        }
      }

      if (fixedDiagnostics.length > 0) {
        lines.push("");
        lines.push("Fixed problems:");
        for (const d of fixedDiagnostics) {
          lines.push(`  ${d.severity.toUpperCase()} ${d.code} ${d.path}${d.line ? `:${d.line}` : ""}`);
          lines.push(`    ${d.message}`);
        }
      }

      console.log(lines.join("\n"));
    }
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore cleanup errors */ }
  }
}

function runFixCommand(options: FixOptions): void {
  const config = loadConfig();
  const result = runFix(options, config);

  if (options.json) {
    console.log(formatJsonFixResult(result));
    return;
  }

  console.log(formatHumanFixResult(result, options.dryRun ? result.diffs : undefined));
}

function runInitCommand(): void {
  const result = initConfig();
  console.log(`Created ${result.path}`);
  console.log("Tip: run ctxscope init --agent <agent> to create agent instructions.");
}

function runInitAgentCommand(args: string[]): void {
  let agent: AgentTarget | undefined;
  let dryRun = false;
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--agent") {
      agent = args[index + 1] as AgentTarget;
      index += 1;
      continue;
    }

    if (arg.startsWith("--agent=")) {
      agent = arg.slice("--agent=".length) as AgentTarget;
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`unknown option '${arg}'`);
    }
  }

  if (!agent) {
    fail("missing --agent. Usage: ctxscope init --agent claude");
  }

  const validTargets: AgentTarget[] = ["claude", "codex", "opencode", "cursor", "copilot", "gemini", "windsurf"];
  if (!validTargets.includes(agent)) {
    fail(`unsupported agent '${agent}'. Expected one of: ${validTargets.join(", ")}`);
  }

  const root = process.cwd();
  const facts = detectRepoFacts(root);
  const result = generateInstructions({
    agent,
    root,
    dryRun,
    force,
    packageManager: facts.packageManager,
    scripts: facts.scripts,
    packageName: facts.packageName,
    bin: facts.bin,
    sourceDirectories: facts.sourceDirectories,
    docsDirectories: facts.docsDirectories,
    detectedTools: facts.detectedTools,
    readmeHeadings: facts.readmeHeadings,
  });

  console.log(formatGenerateResultHuman(result));
}

function runGenerateCommand(args: string[]): void {
  let agent: AgentTarget | undefined;
  let dryRun = false;
  let force = false;
  let target = ".";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--agent") {
      agent = args[index + 1] as AgentTarget;
      index += 1;
      continue;
    }

    if (arg.startsWith("--agent=")) {
      agent = arg.slice("--agent=".length) as AgentTarget;
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`unknown option '${arg}'`);
    }

    target = arg;
  }

  if (!agent) {
    fail("missing --agent. Usage: ctxscope generate --agent claude");
  }

  const validTargets: AgentTarget[] = ["claude", "codex", "opencode", "cursor", "copilot", "gemini", "windsurf"];
  if (!validTargets.includes(agent)) {
    fail(`unsupported agent '${agent}'. Expected one of: ${validTargets.join(", ")}`);
  }

  const root = target;
  const facts = detectRepoFacts(root);
  const result = generateInstructions({
    agent,
    root,
    dryRun,
    force,
    packageManager: facts.packageManager,
    scripts: facts.scripts,
    packageName: facts.packageName,
    bin: facts.bin,
    sourceDirectories: facts.sourceDirectories,
    docsDirectories: facts.docsDirectories,
    detectedTools: facts.detectedTools,
    readmeHeadings: facts.readmeHeadings,
  });

  console.log(formatGenerateResultHuman(result));
}

function runExplainCommand(args: string[]): void {
  let json = false;
  let code: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`unknown option '${arg}'`);
    }

    if (code) {
      fail(`unexpected extra argument '${arg}'`);
    }

    code = arg;
  }

  if (!code) {
    fail("missing diagnostic code. Usage: ctxscope explain CTX102");
  }

  const explanation = getExplanationOrThrow(code);

  if (json) {
    console.log(formatJsonExplainResult(explanation));
  } else {
    console.log(formatHumanExplainResult(explanation));
  }
}

function runTopCommand(args: string[]): void {
  const config = loadConfig();
  const options = parseScanOptions(args);
  const result = scanContext(options.target, options.agent, config);
  const sorted = [...result.files].sort((a, b) => b.tokens - a.tokens);
  const maxLen = sorted.reduce((m, f) => Math.max(m, f.path.length), 0);
  const lines = sorted.map((f) => `${f.path.padEnd(maxLen)}  ~${f.tokens}`);
  const header = `${"-".repeat(maxLen + 10)}\n${"Path".padEnd(maxLen)}  Tokens\n${"-".repeat(maxLen + 10)}`;

  const savings: string[] = [];
  const ctx006 = result.warnings.filter((w) => w.code === "CTX006").length;
  if (ctx006 > 0) {
    savings.push(`  repeated paragraphs             ~${ctx006 * 420}`);
  }

  const output = [
    "Largest Context Files",
    "",
    header,
    ...lines,
  ];

  if (savings.length > 0) {
    output.push("");
    output.push("Potential savings:");
    output.push(...savings);
  }

  console.log(output.join("\n"));
}

function runCostCommand(args: string[]): void {
  const config = loadConfig();
  const options = parseScanOptions(args);
  const result = scanContext(options.target, options.agent, config);

  const overBudget = result.totalTokens > config.maxTokens ? result.totalTokens - config.maxTokens : 0;
  const ctx006 = result.warnings.filter((w) => w.code === "CTX006").length;
  const dupWaste = ctx006 * 420;

  const output = [
    "Context Overhead",
    "",
    `  Current agent context:`,
    `    ~${result.totalTokens} tokens`,
    "",
    "  Efficiency:",
    `    budget: ${config.maxTokens}`,
    `    over budget: ~${overBudget}`,
    `    repeated paragraph waste: ~${dupWaste}`,
  ];

  console.log(output.join("\n"));
}

function main(argv: string[]): void {
  const [command, ...args] = argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(getVersion());
    return;
  }

  if (command === "scan") {
    try {
      runScan(parseScanOptions(args));
    } catch (error) {
      if (error instanceof ConfigError) {
        fail(error.message);
      }

      throw error;
    }
    return;
  }

  if (command === "init") {
    if (args.length === 0) {
      try {
        runInitCommand();
      } catch (error) {
        if (error instanceof InitError) {
          fail(error.message);
        }
        throw error;
      }
      return;
    }

    if (args[0] === "--config") {
      try {
        runInitCommand();
      } catch (error) {
        if (error instanceof InitError) {
          fail(error.message);
        }
        throw error;
      }
      return;
    }

    if (args[0] === "--agent" || args[0]?.startsWith("--agent=")) {
      runInitAgentCommand(args);
      return;
    }

    fail(`unknown init option '${args[0]}'. Use --config or --agent.`);
  }

  if (command === "doctor") {
    try {
      runDoctorCommand(parseDoctorOptions(args));
    } catch (error) {
      if (error instanceof ConfigError) {
        fail(error.message);
      }

      throw error;
    }
    return;
  }

  if (command === "fix") {
    try {
      runFixCommand(parseFixOptions(args));
    } catch (error) {
      if (error instanceof ConfigError) {
        fail(error.message);
      }

      throw error;
    }
    return;
  }

  if (command === "explain") {
    runExplainCommand(args);
    return;
  }

  if (command === "top") {
    runTopCommand(args);
    return;
  }

  if (command === "cost") {
    runCostCommand(args);
    return;
  }

  if (command === "generate") {
    runGenerateCommand(args);
    return;
  }

  if (command === "completion") {
    const shell = args[0] as Shell | undefined;
    if (!shell || !["zsh", "bash", "fish"].includes(shell)) {
      fail("missing shell. Usage: ctxscope completion zsh | bash | fish");
    }
    console.log(generateCompletion(shell));
    return;
  }

  fail(`unknown command '${command}'`);
}

main(process.argv.slice(2));
