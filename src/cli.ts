#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { ConfigError, loadConfig } from "./config.js";
import { runDoctor } from "./doctor.js";
import { InitError, initConfig } from "./init.js";
import { formatHumanDoctorResult, formatHumanScanResult, formatJsonDoctorResult, formatJsonScanResult } from "./output.js";
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
  ctxscope init
  ctxscope scan [path] [--agent <agent>] [--json]
  ctxscope doctor [path] [--agent <agent>] [--json] [--ci]

Commands:
  init                 Create ctxscope.config.json.
  scan                 Discover coding-agent context files for a path.
  doctor               Lint coding-agent context files.

Options:
  --agent <agent>      Agent profile: all, codex, opencode, claude, generic.
                       Default: all.
  --json               Print machine-readable JSON.
  --ci                 Exit 1 when doctor finds errors.
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
  const result = runDoctor(options.target, options.agent, config);

  if (options.json) {
    console.log(formatJsonDoctorResult(result));
  } else {
    console.log(formatHumanDoctorResult(result));
  }

  if (options.ci && result.status === "fail") {
    process.exit(1);
  }
}

function runInitCommand(): void {
  const result = initConfig();
  console.log(`Created ${result.path}`);
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
    if (args.length > 0) {
      fail(`init does not accept arguments: ${args.join(" ")}`);
    }

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

  fail(`unknown command '${command}'`);
}

main(process.argv.slice(2));
