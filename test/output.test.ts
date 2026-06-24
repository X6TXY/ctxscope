import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_CONFIG } from "../src/config.js";
import { runDoctor } from "../src/doctor.js";
import { runFix } from "../src/fix.js";
import { formatHumanDoctorResult, formatHumanFixResult } from "../src/output.js";

const { test } = await import(`node:${"test"}`);

test("fix dry-run human output includes unified diff", () => {
  const root = makeFixture("output-fix-diff");
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(join(root, "AGENTS.md"), "# Instructions\n\nRun npm install and npm run test.\n");

  const result = runFix({ target: root, agent: "all", dryRun: true }, DEFAULT_CONFIG);
  const output = formatHumanFixResult(result, result.diffs);

  assert.match(output, /Diff\s+AGENTS\.md/);
  assert.match(output, /--- a\/AGENTS\.md/);
  assert.match(output, /\+\+\+ b\/AGENTS\.md/);
  assert.match(output, /-Run npm install and npm run test\./);
  assert.match(output, /\+Run pnpm install and pnpm test\./);
});

test("doctor verbose output includes score breakdown penalties", () => {
  const root = makeFixture("output-doctor-verbose");
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));
  writeFileSync(join(root, "AGENTS.md"), "# Instructions\n\nRun npm run test:e2e.\nCheck src/missing.\n");

  const result = runDoctor(root, "all", DEFAULT_CONFIG);
  const output = formatHumanDoctorResult(result, true);

  assert.match(output, /Agent Context Score\s+\d+\/100/);
  assert.match(output, /Correctness\s+\d+\/100/);
  assert.match(output, /-\d+\s+CTX102/);
  assert.match(output, /-\d+\s+CTX103/);
  assert.match(output, /Coverage\s+100\/100/);
});

function makeFixture(name: string): string {
  const root = join(tmpdir(), `ctxscope-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}
