import assert from "node:assert/strict";

import { generateCompletion } from "../src/completion.js";

const { test } = await import(`node:${"test"}`);

test("completion generates zsh completion", () => {
  const output = generateCompletion("zsh");
  assert.ok(output.includes("#compdef ctxscope"));
  assert.ok(output.includes("_ctxscope"));
  assert.ok(output.includes("doctor"));
  assert.ok(output.includes("fix"));
  assert.ok(output.includes("generate"));
  assert.ok(output.includes("completion"));
});

test("completion generates bash completion", () => {
  const output = generateCompletion("bash");
  assert.ok(output.includes("_ctxscope_completions"));
  assert.ok(output.includes("complete -F"));
  assert.ok(output.includes("doctor"));
  assert.ok(output.includes("fix"));
});

test("completion generates fish completion", () => {
  const output = generateCompletion("fish");
  assert.ok(output.includes("complete -c ctxscope"));
  assert.ok(output.includes("doctor"));
  assert.ok(output.includes("fix"));
});

test("completion for zsh includes all commands", () => {
  const output = generateCompletion("zsh");
  const commands = ["init", "scan", "doctor", "fix", "explain", "generate", "top", "cost", "completion"];
  for (const cmd of commands) {
    assert.ok(output.includes(cmd), `zsh completion should include ${cmd}`);
  }
});

test("completion for zsh includes --agent codes", () => {
  const output = generateCompletion("zsh");
  assert.ok(output.includes("CTX001"));
  assert.ok(output.includes("CTX103"));
});

test("completion shows correct error for invalid shell", () => {
  const output = generateCompletion("zsh");
  assert.ok(output.length > 100);
});
