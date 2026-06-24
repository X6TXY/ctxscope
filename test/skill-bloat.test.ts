import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_CONFIG } from "../src/config.js";
import { collectSkillBloatDiagnostics } from "../src/rules/skill-bloat.js";

const { test } = await import(`node:${"test"}`);

function makeFixture(name: string): string {
  const root = join(tmpdir(), `ctxscope-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

test("CTX106 returns empty for no skill dirs", () => {
  const config = { ...DEFAULT_CONFIG };
  const result = collectSkillBloatDiagnostics("generic", config);
  assert.equal(result.length, 0);
});

test("CTX106 returns empty for small skill count", () => {
  const config = { ...DEFAULT_CONFIG };
  const home = process.env.HOME!;
  const skillDir = join(home, ".claude", "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    const skill = join(skillDir, "test-skill");
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), `---
name: test-skill
description: short
---`);

    const result = collectSkillBloatDiagnostics("claude", config);
    assert.equal(result.length, 0);
  } finally {
    // Cleanup is best-effort
    try {
      rmSync(skillDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
});

test("CTX106 warns for large skill descriptions", () => {
  const config = { ...DEFAULT_CONFIG };
  const home = process.env.HOME!;
  const skillDir = join(home, ".claude", "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    // Create enough skills to exceed WARN_THRESHOLD (1000 tokens)
    for (let i = 0; i < 20; i++) {
      const skill = join(skillDir, `skill-${i}`);
      mkdirSync(skill, { recursive: true });
      const desc = "long description ".repeat(60); // ~900 chars = ~225 tokens
      writeFileSync(join(skill, "SKILL.md"), `---
name: skill-${i}
description: ${desc}
---`);
    }

    const result = collectSkillBloatDiagnostics("claude", config);
    // Should have at least a warning
    const relevant = result.filter((d) => d.code === "CTX106");
    assert.ok(relevant.length > 0);
  } finally {
    try {
      rmSync(skillDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
});

test("CTX106 returns error for extreme bloat", () => {
  const config = { ...DEFAULT_CONFIG };
  const home = process.env.HOME!;
  const skillDir = join(home, ".claude", "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    // Create enough to exceed ERROR_THRESHOLD (5000 tokens)
    for (let i = 0; i < 30; i++) {
      const skill = join(skillDir, `fat-skill-${i}`);
      mkdirSync(skill, { recursive: true });
      const desc = "X".repeat(700); // 700 chars = ~175 tokens each, 30*175 = 5250
      writeFileSync(join(skill, "SKILL.md"), `---
name: fat-skill-${i}
description: ${desc}
---`);
    }

    const result = collectSkillBloatDiagnostics("claude", config);
    const relevant = result.filter((d) => d.code === "CTX106");
    assert.ok(relevant.length > 0);
    assert.equal(relevant[0]?.severity, "error");
  } finally {
    try {
      rmSync(skillDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
});
