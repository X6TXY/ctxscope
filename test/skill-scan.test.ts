import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { scanSkillDir, scanSkillDirs } from "../src/skill-scan.js";

const { test } = await import(`node:${"test"}`);

function makeFixture(name: string): string {
  const root = join(tmpdir(), `ctxscope-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

test("scanSkillDir returns empty for non-existent dir", () => {
  const result = scanSkillDir("/nonexistent/path");
  assert.equal(result.length, 0);
});

test("scanSkillDir returns empty for empty dir", () => {
  const root = makeFixture("empty-skill-dir");
  mkdirSync(join(root, "empty-folder"));
  const result = scanSkillDir(root);
  assert.equal(result.length, 0);
});

test("scanSkillDir finds skills with SKILL.md", () => {
  const root = makeFixture("skill-dir");
  const reactDir = join(root, "react-components");
  mkdirSync(reactDir, { recursive: true });
  writeFileSync(join(reactDir, "SKILL.md"), `---
name: react-components
description: Patterns and best practices for React component design
---

# React Components
Details here.
`);

  const deployDir = join(root, "docker-deploy");
  mkdirSync(deployDir, { recursive: true });
  writeFileSync(join(deployDir, "SKILL.md"), `---
name: docker-deploy
description: Docker deployment strategies
---

# Docker Deploy
Details here.
`);

  const results = scanSkillDir(root);
  assert.equal(results.length, 2);

  const react = results.find((s) => s.dirName === "react-components")!;
  assert.ok(react);
  assert.equal(react.name, "react-components");
  assert.ok(react.descriptionTokens > 0);
});

test("scanSkillDir reads name from dirName when frontmatter missing", () => {
  const root = makeFixture("skill-no-fm");
  const dir = join(root, "my-custom-tool");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), "# My Custom Tool\n\nSome content.\n");

  const results = scanSkillDir(root);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.name, "my-custom-tool");
  assert.equal(results[0]?.description, "");
});

test("scanSkillDir skips directories without SKILL.md", () => {
  const root = makeFixture("skill-no-file");
  mkdirSync(join(root, "empty-dir"), { recursive: true });
  writeFileSync(join(root, "empty-dir", "other.txt"), "not a skill");

  const results = scanSkillDir(root);
  assert.equal(results.length, 0);
});

test("scanSkillDirs aggregates from multiple dirs", () => {
  const dir1 = makeFixture("multi-dir1");
  const dir2 = makeFixture("multi-dir2");

  mkdirSync(join(dir1, "skill-a"), { recursive: true });
  writeFileSync(join(dir1, "skill-a", "SKILL.md"), `---
name: skill-a
description: First skill
---`);

  mkdirSync(join(dir2, "skill-b"), { recursive: true });
  writeFileSync(join(dir2, "skill-b", "SKILL.md"), `---
name: skill-b
description: Second skill
---`);

  const result = scanSkillDirs([dir1, dir2]);
  assert.equal(result.skills.length, 2);
  assert.equal(result.dirBreakdown.length, 2);
  assert.ok(result.totalTokenCost > 0);
});
