#!/usr/bin/env node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { formatCategoriesResult, generateCategoriesFile } from "./categories.js";
import { generateCompletion, type Shell } from "./completion.js";
import { ConfigError, loadConfig } from "./config.js";
import { runDoctor } from "./doctor.js";
import { getExplanationOrThrow } from "./explain.js";
import { runFix } from "./fix.js";
import { formatGenerateResultHuman, generateInstructions, type AgentTarget } from "./generate.js";
import { getChangedFiles, getFileContentAtRef, isGitRepo, listFilesAtRef } from "./git.js";
import { InitError, initConfig } from "./init.js";
import { formatOptimizeResult, runOptimizeCommand } from "./optimize.js";
import { formatHumanDoctorResult, formatHumanExplainResult, formatHumanFixResult, formatHumanScanResult, formatJsonDoctorResult, formatJsonExplainResult, formatJsonFixResult, formatJsonScanResult } from "./output.js";
import { computeRepoFactsDelta, detectRepoFactsAtRef, formatDeltaHuman } from "./repo-facts-diff.js";
import { detectRepoFacts } from "./repo-facts.js";
import { scanContext } from "./scan.js";
import { SUPPORTED_AGENTS, type Agent } from "./types.js";

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
  const rows = (items: Array<[string, string]>): string => formatRows(items, 32);

  console.log(`ctxscope ${getVersion()}

Keep AI coding-agent instructions in sync with your repository.

Core:
${rows([
  ["ctxscope scan [path]", "inventory discovered context files"],
  ["ctxscope diagnose [path]", "validate context files and score health"],
  ["ctxscope fix [path]", "preview or apply deterministic safe fixes"],
  ["ctxscope generate [path]", "generate deterministic agent instructions"],
])}

Inspect:
${rows([
  ["ctxscope largest [path]", "show largest context files"],
  ["ctxscope tokens [path]", "estimate context token overhead"],
  ["ctxscope explain <code>", "explain a diagnostic code"],
])}

Skills:
${rows([
  ["ctxscope skills categories", "generate skill category map"],
  ["ctxscope skills optimize", "consolidate skills into lightweight pointers"],
])}

Setup:
${rows([
  ["ctxscope init", "create ctxscope.config.json"],
  ["ctxscope init --agent <agent>", "create agent instructions"],
  ["ctxscope completion <shell>", "generate shell completion script"],
])}

Aliases:
${rows([
  ["doctor", "alias for diagnose"],
  ["top", "alias for largest"],
  ["cost", "alias for tokens"],
  ["categories", "alias for skills categories"],
  ["optimize", "alias for skills optimize"],
])}

Options:
${rows([
  ["-h, --help", "show help"],
  ["-v, --version", "show version"],
  ["--agent <agent>", "all, codex, opencode, claude, generic  [default: all]"],
  ["--json", "print machine-readable JSON"],
  ["--ci", "exit 1 when diagnose finds errors"],
  ["--verbose", "show detailed score breakdown"],
  ["--dry-run", "preview without writing"],
  ["--force", "overwrite existing generated files"],
  ["--target <agent>", "target agent for skills optimize"],
  ["--vault <path>", "vault directory for skill storage"],
  ["--undo", "restore skills from vault"],
  ["--noninteractive", "skip category prompt and use heuristics"],
])}
`);
}

function formatRows(items: Array<[string, string]>, width: number): string {
  return items
    .map(([left, right]) => {
      const spacing = left.length >= width ? "  " : " ".repeat(width - left.length);
      return `  ${left}${spacing}${right}`;
    })
    .join("\n");
}

type OptimizeCliOptions = {
  target: Agent;
  vaultDir: string | undefined;
  dryRun: boolean;
  undo: boolean;
  noninteractive: boolean;
};

function parseOptimizeOptions(args: string[]): OptimizeCliOptions {
  const options: OptimizeCliOptions = {
    target: "all",
    vaultDir: undefined,
    dryRun: false,
    undo: false,
    noninteractive: false,
  };

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

    if (arg === "--undo") {
      options.undo = true;
      continue;
    }

    if (arg === "--noninteractive" || arg === "-n") {
      options.noninteractive = true;
      continue;
    }

    if (arg === "--target") {
      options.target = parseAgent(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--target=")) {
      options.target = parseAgent(arg.slice("--target=".length));
      continue;
    }

    if (arg === "--vault") {
      options.vaultDir = args[index + 1];
      if (!options.vaultDir || options.vaultDir.startsWith("-")) {
        fail("missing value for --vault");
      }
      index += 1;
      continue;
    }

    if (arg.startsWith("--vault=")) {
      options.vaultDir = arg.slice("--vault=".length);
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`unknown option '${arg}'`);
    }
  }

  return options;
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

async function main(argv: string[]): Promise<void> {
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

  if (command === "doctor" || command === "diagnose") {
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

  if (command === "top" || command === "largest") {
    runTopCommand(args);
    return;
  }

  if (command === "cost" || command === "tokens") {
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

  if (command === "skills") {
    const [subcommand, ...subArgs] = args;

    if (!subcommand || subcommand === "--help" || subcommand === "-h") {
      console.log(`ctxscope skills

Manage agent skills and skill category maps.

Commands:
  ctxscope skills categories      generate skill category map
  ctxscope skills optimize        consolidate skills into lightweight pointers

Options:
  --target <agent>                target agent for optimize
  --vault <path>                  vault directory for skill storage
  --dry-run                       preview without writing
  --undo                          restore skills from vault
  --noninteractive                skip category prompt and use heuristics
`);
      return;
    }

    if (subcommand === "categories") {
      const result = generateCategoriesFile("all");
      console.log(formatCategoriesResult(result));
      return;
    }

    if (subcommand === "optimize") {
      const options = parseOptimizeOptions(subArgs);
      const result = await runOptimizeCommand({
        target: options.target,
        vaultDir: options.vaultDir,
        dryRun: options.dryRun,
        undo: options.undo,
        noninteractive: options.noninteractive,
      });
      console.log(formatOptimizeResult(result));
      return;
    }

    fail(`unknown skills command '${subcommand}'. Expected categories or optimize.`);
  }

  if (command === "categories") {
    const result = generateCategoriesFile("all");
    console.log(formatCategoriesResult(result));
    return;
  }

  if (command === "optimize") {
    const options = parseOptimizeOptions(args);
    const result = await runOptimizeCommand({
      target: options.target,
      vaultDir: options.vaultDir,
      dryRun: options.dryRun,
      undo: options.undo,
      noninteractive: options.noninteractive,
    });
    console.log(formatOptimizeResult(result));
    return;
  }

  fail(`unknown command '${command}'`);
}

main(process.argv.slice(2));
