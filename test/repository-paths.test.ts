import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { DEFAULT_CONFIG } from "../src/config.js";
import { collectPathDiagnostics } from "../src/rules/repository-paths.js";

const { test } = await import(`node:${"test"}`);

function makeFixture(name: string): string {
  const root = join(tmpdir(), `ctxscope-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

test("CTX103 detects missing referenced directory", () => {
  const root = makeFixture("ctx103-missing-dir");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "CLAUDE.md"), "The source is in apps/api.\n");

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectPathDiagnostics(root, files, DEFAULT_CONFIG);
  assert.ok(diagnostics.length > 0);
  assert.equal(diagnostics[0]?.code, "CTX103");
  assert.ok(diagnostics[0]?.message.includes("apps/api"));
});

test("CTX103 does not flag existing paths", () => {
  const root = makeFixture("ctx103-existing");
  mkdirSync(join(root, "src", "components"), { recursive: true });
  writeFileSync(join(root, "CLAUDE.md"), "Check src/components for UI.\n");

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectPathDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX103");
  assert.equal(relevant.length, 0);
});

test("CTX103 does not flag URLs or absolute paths", () => {
  const root = makeFixture("ctx103-urls");
  writeFileSync(join(root, "AGENTS.md"), "See https://example.com/docs\nCheck /etc/config\n");

  const files = [{
    path: "AGENTS.md",
    agents: ["codex" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectPathDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX103");
  assert.equal(relevant.length, 0);
});

test("CTX103 suggests similar paths", () => {
  const root = makeFixture("ctx103-suggest");
  mkdirSync(join(root, "apps", "backend"), { recursive: true });
  writeFileSync(join(root, "CLAUDE.md"), "Look in apps/api.\n");

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectPathDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX103");
  assert.ok(relevant.length > 0);
  assert.ok(relevant[0]?.message.includes("apps/backend") || relevant[0]?.recommendation?.includes("apps/backend"));
});

test("CTX103 does not flag template paths with <placeholders>", () => {
  const root = makeFixture("ctx103-template");
  writeFileSync(join(root, "CLAUDE.md"), "See docs/plans/YYYY-MM-DD-<feature-name> for details.\nCheck docs/systems/<system-name>.\n");

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectPathDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX103");
  assert.equal(relevant.length, 0);
});

test("CTX103 does not flag node_modules paths", () => {
  const root = makeFixture("ctx103-node-modules");
  writeFileSync(join(root, "CLAUDE.md"), "Check node_modules/express.\n");

  const files = [{
    path: "CLAUDE.md",
    agents: ["claude" as const],
    tokens: 10,
    skippedBinary: false,
  }];

  const diagnostics = collectPathDiagnostics(root, files, DEFAULT_CONFIG);
  const relevant = diagnostics.filter((d) => d.code === "CTX103");
  assert.equal(relevant.length, 0);
});
