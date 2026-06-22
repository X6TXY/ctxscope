const { test } = await import(`node:${"test"}`);
import assert from "node:assert/strict";

import { getExplanation, getAllCodes, getExplanationOrThrow } from "../src/explain.js";

test("explain returns explanation for known codes", () => {
  const explanation = getExplanation("CTX102");
  assert.ok(explanation);
  assert.equal(explanation.code, "CTX102");
  assert.equal(explanation.title, "Missing package script");
  assert.equal(explanation.severity, "error");
  assert.ok(explanation.problem.length > 0);
  assert.ok(explanation.whyItMatters.length > 0);
  assert.ok(explanation.fix.length > 0);
});

test("explain returns undefined for unknown codes", () => {
  const explanation = getExplanation("CTX999");
  assert.equal(explanation, undefined);
});

test("explain throws for unknown codes with helpful message", () => {
  assert.throws(() => getExplanationOrThrow("CTX999"), /Unknown diagnostic code/);
});

test("getAllCodes returns all known codes", () => {
  const codes = getAllCodes();
  assert.ok(codes.length >= 9);
  assert.ok(codes.includes("CTX001"));
  assert.ok(codes.includes("CTX006"));
  assert.ok(codes.includes("CTX101"));
  assert.ok(codes.includes("CTX102"));
  assert.ok(codes.includes("CTX105"));
});

test("CTX006 is marked as safe autofix", () => {
  const explanation = getExplanation("CTX006");
  assert.ok(explanation?.safeAutofix);
});

test("CTX101 is marked as safe autofix", () => {
  const explanation = getExplanation("CTX101");
  assert.ok(explanation?.safeAutofix);
});

test("CTX102 is not safe autofix", () => {
  const explanation = getExplanation("CTX102");
  assert.equal(explanation?.safeAutofix, false);
});
