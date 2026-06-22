import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

import { DEFAULT_CONFIG } from "../src/config.js";
import { runDoctor } from "../src/doctor.js";

const { test } = await import(`node:${"test"}`);

test("doctor diagnostics include locations and recommendations", () => {
  const root = makeFixture("doctor-locations");
  writeFileSync(join(root, "AGENTS.md"), [
    "# Agent instructions",
    "",
    "Use [missing](./missing.md).",
    "",
    "TODO remove this stale instruction.",
  ].join("\n"));

  const result = runDoctor(root, "all", DEFAULT_CONFIG);
  const staleLink = result.diagnostics.find((diagnostic) => diagnostic.code === "CTX003");
  const marker = result.diagnostics.find((diagnostic) => diagnostic.code === "CTX005");

  assert.equal(staleLink?.line, 3);
  assert.match(staleLink?.recommendation ?? "", /stale link/);
  assert.equal(marker?.line, 5);
  assert.match(marker?.recommendation ?? "", /TODO/);
});

function makeFixture(name: string): string {
  const root = join(tmpdir(), `ctxscope-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}
