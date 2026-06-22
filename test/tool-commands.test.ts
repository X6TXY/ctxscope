import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_CONFIG } from "../src/config.js";
import { collectToolCommandDiagnostics } from "../src/rules/tool-commands.js";

const { test } = await import(`node:${"test"}`);

function makeFixture(name: string): string {
  const root = join(tmpdir(), `ctxscope-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

test("CTX104 warns on unrecognized command reference", () => {
  const root = makeFixture("ctx104-unknown");
  writeFileSync(join(root, "CLAUDE.md"), "Run some-unknown-tool --flag\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({
    scripts: { test: "jest" },
  }));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.ok(relevant.length > 0);
  assert.ok(relevant[0]?.message.includes("some-unknown-tool"));
});

test("CTX104 does not warn on known commands (git, node, npm)", () => {
  const root = makeFixture("ctx104-known");
  writeFileSync(join(root, "CLAUDE.md"), "Run git status.\nUse node --version.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 0);
});

test("CTX104 does not warn on package.json scripts", () => {
  const root = makeFixture("ctx104-scripts");
  writeFileSync(join(root, "CLAUDE.md"), "Run lint.\nRun test.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({
    scripts: {
      lint: "eslint .",
      test: "jest",
    },
  }));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 0);
});

test("CTX104 does not warn on detected tools like next, vite", () => {
  const root = makeFixture("ctx104-tools");
  writeFileSync(join(root, "CLAUDE.md"), "Run next build.\nRun vite --port 3000.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({
    scripts: { build: "next build" },
  }));
  writeFileSync(join(root, "next.config.js"), "");

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 0);
});

test("CTX104 warns on unknown command from code block", () => {
  const root = makeFixture("ctx104-codeblock");
  writeFileSync(join(root, "CLAUDE.md"), "```bash\nunknown-tool do-something\n```\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.ok(relevant.length > 0);
});

test("CTX104 skips common English words following run/use", () => {
  const root = makeFixture("ctx104-common");
  writeFileSync(join(root, "CLAUDE.md"),
    "Run this command.\nUse the following.\nExecute it now.\nFor more, see the docs.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 0);
});

test("CTX104 skips CLI flags (--flag style)", () => {
  const root = makeFixture("ctx104-flags");
  writeFileSync(join(root, "CLAUDE.md"),
    "Use --debug-query=cst.\nRun --pattern '*.ts'.\nExecute --verbose.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 0);
});

test("CTX104 skips dotted identifiers (foo.bar)", () => {
  const root = makeFixture("ctx104-dotted");
  writeFileSync(join(root, "CLAUDE.md"),
    "Use service.name.\nRun damping.product.decision.completed.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 0);
});

test("CTX104 skips single-character commands", () => {
  const root = makeFixture("ctx104-single");
  writeFileSync(join(root, "CLAUDE.md"),
    "Run q.\nUse x.\nExecute y.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 0);
});

test("CTX104 skips backtick-wrapped references", () => {
  const root = makeFixture("ctx104-backtick");
  writeFileSync(join(root, "CLAUDE.md"),
    "Run `config`.\nUse `logger`.\nRun `stopBy`.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 0);
});

test("CTX104 skips quoted strings", () => {
  const root = makeFixture("ctx104-quoted");
  writeFileSync(join(root, "CLAUDE.md"),
    "Run \"Spec\".\nUse 'Some'.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 0);
});

test("CTX104 skips shell redirect/pipes", () => {
  const root = makeFixture("ctx104-redirect");
  writeFileSync(join(root, "CLAUDE.md"),
    "Run > output.log.\nUse | grep foo.\nExecute 2>&1.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 0);
});

test("CTX104 still catches real unknown commands mixed with prose", () => {
  const root = makeFixture("ctx104-mixed");
  writeFileSync(join(root, "CLAUDE.md"),
    "Run this tool using some-unknown-utility --flag.\nAlso use another-unknown-tool.\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectToolCommandDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX104");
  assert.equal(relevant.length, 2);
  assert.ok(relevant.some((d) => d.message.includes("some-unknown-utility")));
  assert.ok(relevant.some((d) => d.message.includes("another-unknown-tool")));
});
