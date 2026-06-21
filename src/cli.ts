#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { formatHumanScanResult, formatJsonScanResult } from "./output.js";
import { scanContext } from "./scan.js";
import { SUPPORTED_AGENTS, type Agent } from "./types.js";

type ScanOptions = {
  agent: Agent;
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
  ctxscope scan [path] [--agent <agent>] [--json]

Commands:
  scan                 Discover coding-agent context files for a path.

Options:
  --agent <agent>      Agent profile: all, codex, opencode, claude, generic.
                       Default: all.
  --json               Print machine-readable JSON.
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

function runScan(options: ScanOptions): void {
  const result = scanContext(options.target, options.agent);

  if (options.json) {
    console.log(formatJsonScanResult(result));
    return;
  }

  console.log(formatHumanScanResult(result));
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
    runScan(parseScanOptions(args));
    return;
  }

  fail(`unknown command '${command}'`);
}

main(process.argv.slice(2));
