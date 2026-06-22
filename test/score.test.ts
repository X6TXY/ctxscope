import assert from "node:assert/strict";

import { DEFAULT_CONFIG } from "../src/config.js";
import { calculateContextScore } from "../src/score.js";
import type { Diagnostic, ScanResult } from "../src/types.js";

const { test } = await import(`node:${"test"}`);

test("context score penalizes errors more than warnings", () => {
  const scan: ScanResult = {
    agent: "all",
    target: ".",
    files: [{ path: "AGENTS.md", agents: ["generic"], tokens: 100, skippedBinary: false }],
    totalTokens: 100,
    warnings: [],
  };
  const warningDiagnostics: Diagnostic[] = [{ code: "CTX005", severity: "warn", path: "AGENTS.md", message: "marker" }];
  const errorDiagnostics: Diagnostic[] = [{ code: "CTX102", severity: "error", path: "AGENTS.md", message: "missing script" }];

  const warningScore = calculateContextScore(scan, warningDiagnostics, DEFAULT_CONFIG);
  const errorScore = calculateContextScore(scan, errorDiagnostics, DEFAULT_CONFIG);

  assert.ok(errorScore.overall < warningScore.overall);
  assert.ok(errorScore.correctness < warningScore.correctness);
});

test("context score includes budget and duplication pressure", () => {
  const scan: ScanResult = {
    agent: "all",
    target: ".",
    files: [{ path: "AGENTS.md", agents: ["generic"], tokens: 9000, skippedBinary: false }],
    totalTokens: 9000,
    warnings: [],
  };
  const diagnostics: Diagnostic[] = [
    { code: "CTX006", severity: "warn", path: "AGENTS.md", message: "duplicate" },
    { code: "CTX105", severity: "error", path: ".", message: "budget" },
  ];

  const score = calculateContextScore(scan, diagnostics, DEFAULT_CONFIG);

  assert.ok(score.overall < 80);
  assert.ok(score.efficiency < 80);
});
