const { test } = await import(`node:${"test"}`);
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generateInstructions, getAgentPath, formatGenerateResultHuman } from "../src/generate.js";

function makeFixture(name: string): string {
  const root = join(tmpdir(), `ctxscope-generate-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

const baseOptions = {
  root: "",
  packageManager: "pnpm",
  scripts: { build: "pnpm build", test: "pnpm test" },
  packageName: "test-pkg",
  sourceDirectories: ["src"],
  docsDirectories: ["docs"],
  detectedTools: ["build", "test"],
  readmeHeadings: ["Overview", "Setup"],
};

test("generate creates CLAUDE.md for claude agent", () => {
  const root = makeFixture("claude");
  const options = { ...baseOptions, root, agent: "claude" as const, dryRun: false, force: false };
  const result = generateInstructions(options);

  assert.equal(result.path, "CLAUDE.md");
  assert.ok(result.written);
  assert.ok(existsSync(join(root, "CLAUDE.md")));
  assert.match(readFileSync(join(root, "CLAUDE.md"), "utf8"), /Package Manager/);
});

test("generate creates AGENTS.md for codex agent", () => {
  const root = makeFixture("codex");
  const options = { ...baseOptions, root, agent: "codex" as const, dryRun: false, force: false };
  const result = generateInstructions(options);

  assert.equal(result.path, "AGENTS.md");
  assert.ok(result.written);
});

test("generate creates GEMINI.md for gemini agent", () => {
  const root = makeFixture("gemini");
  const options = { ...baseOptions, root, agent: "gemini" as const, dryRun: false, force: false };
  const result = generateInstructions(options);

  assert.equal(result.path, "GEMINI.md");
  assert.ok(result.written);
});

test("generate creates windsurf rules file", () => {
  const root = makeFixture("windsurf");
  const options = { ...baseOptions, root, agent: "windsurf" as const, dryRun: false, force: false };
  const result = generateInstructions(options);

  assert.equal(result.path, ".windsurf/rules/ctxscope-generated.md");
  assert.ok(result.written);
});

test("generate creates cursor rules file", () => {
  const root = makeFixture("cursor");
  const options = { ...baseOptions, root, agent: "cursor" as const, dryRun: false, force: false };
  const result = generateInstructions(options);

  assert.equal(result.path, ".cursor/rules/ctxscope-generated.mdc");
  assert.ok(result.written);
});

test("generate creates copilot instructions file", () => {
  const root = makeFixture("copilot");
  const options = { ...baseOptions, root, agent: "copilot" as const, dryRun: false, force: false };
  const result = generateInstructions(options);

  assert.equal(result.path, ".github/copilot-instructions.md");
  assert.ok(result.written);
});

test("generate refuses to overwrite without force", () => {
  const root = makeFixture("no-overwrite");
  mkdirSync(join(root, ".cursor", "rules"), { recursive: true });
  writeFileSync(join(root, ".cursor/rules/ctxscope-generated.mdc"), "existing content\n");

  const options = { ...baseOptions, root, agent: "cursor" as const, dryRun: false, force: false };
  const result = generateInstructions(options);

  assert.equal(result.written, false);
  assert.equal(readFileSync(join(root, ".cursor/rules/ctxscope-generated.mdc"), "utf8"), "existing content\n");
});

test("generate overwrites with force", () => {
  const root = makeFixture("force");
  writeFileSync(join(root, "CLAUDE.md"), "old content\n");

  const options = { ...baseOptions, root, agent: "claude" as const, dryRun: false, force: true };
  const result = generateInstructions(options);

  assert.ok(result.written);
  const content = readFileSync(join(root, "CLAUDE.md"), "utf8");
  assert.match(content, /Package Manager/);
});

test("generate dry-run does not write files", () => {
  const root = makeFixture("dry-run");
  const options = { ...baseOptions, root, agent: "claude" as const, dryRun: true, force: false };
  const result = generateInstructions(options);

  assert.ok(result.written); // dryRun reports as written
  assert.equal(existsSync(join(root, "CLAUDE.md")), false);
});

test("generate produces pnpm commands in output", () => {
  const root = makeFixture("pnpm-content");
  const options = { ...baseOptions, root, agent: "claude" as const, dryRun: false, force: false };
  const result = generateInstructions(options);

  assert.match(result.content, /pnpm/);
});

test("formatGenerateResultHuman shows created and exists messages", () => {
  const createdResult = { path: "CLAUDE.md", written: true, content: "# test\n" };
  assert.match(formatGenerateResultHuman(createdResult), /Created/);

  const skippedResult = { path: "CLAUDE.md", written: false, content: "# test\n" };
  assert.match(formatGenerateResultHuman(skippedResult), /already exists/);
});

test("getAgentPath returns correct paths", () => {
  assert.equal(getAgentPath("claude"), "CLAUDE.md");
  assert.equal(getAgentPath("codex"), "AGENTS.md");
  assert.equal(getAgentPath("gemini"), "GEMINI.md");
  assert.equal(getAgentPath("windsurf"), ".windsurf/rules/ctxscope-generated.md");
  assert.equal(getAgentPath("cursor"), ".cursor/rules/ctxscope-generated.mdc");
  assert.equal(getAgentPath("copilot"), ".github/copilot-instructions.md");
});
