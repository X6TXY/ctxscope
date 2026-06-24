import assert from "node:assert/strict";
import { categorizeSkill, getAllCategories } from "../src/skill-categorize.js";

const { test } = await import(`node:${"test"}`);

test("categorizeSkill classifies security skills", () => {
  assert.equal(categorizeSkill("penetration-testing"), "security");
  assert.equal(categorizeSkill("jwt-auth-flow"), "security");
  assert.equal(categorizeSkill("xss-prevention"), "security");
});

test("categorizeSkill classifies web-dev skills", () => {
  assert.equal(categorizeSkill("react-component-patterns"), "web-dev");
  assert.equal(categorizeSkill("tailwind-utility"), "web-dev");
  assert.equal(categorizeSkill("vue-composables"), "web-dev");
});

test("categorizeSkill classifies devops skills", () => {
  assert.equal(categorizeSkill("docker-compose-setup"), "devops");
  assert.equal(categorizeSkill("kubernetes-deployment"), "devops");
  assert.equal(categorizeSkill("aws-s3-bucket"), "devops");
});

test("categorizeSkill classifies database skills", () => {
  assert.equal(categorizeSkill("postgres-query-optimization"), "database");
  assert.equal(categorizeSkill("prisma-schema-design"), "database");
});

test("categorizeSkill classifies ai-ml skills", () => {
  assert.equal(categorizeSkill("llm-prompt-optimization"), "ai-ml");
  assert.equal(categorizeSkill("rag-pipeline"), "ai-ml");
  assert.equal(categorizeSkill("pytorch-model-training"), "ai-ml");
});

test("categorizeSkill classifies code-review skills", () => {
  assert.equal(categorizeSkill("pr-review-checklist"), "code-review");
  assert.equal(categorizeSkill("code-review-excellence"), "code-review");
});

test("categorizeSkill classifies git skills", () => {
  assert.equal(categorizeSkill("git-rebase-workflow"), "git");
  assert.equal(categorizeSkill("github-actions-ci"), "git");
});

test("categorizeSkill classifies backend-dev skills", () => {
  assert.equal(categorizeSkill("nestjs-api-routes"), "backend-dev");
  assert.equal(categorizeSkill("express-middleware"), "backend-dev");
  assert.equal(categorizeSkill("graphql-resolvers"), "backend-dev");
});

test("categorizeSkill returns other for unknown skills", () => {
  assert.equal(categorizeSkill("my-custom-skill"), "other");
  assert.equal(categorizeSkill("random-thing"), "other");
});

test("categorizeSkill normalizes underscores to hyphens", () => {
  assert.equal(categorizeSkill("react_component_design"), "web-dev");
  assert.equal(categorizeSkill("docker_compose"), "devops");
});

test("getAllCategories returns all 35 categories", () => {
  const categories = getAllCategories();
  assert.ok(categories.includes("security"));
  assert.ok(categories.includes("web-dev"));
  assert.ok(categories.includes("other"));
  assert.ok(categories.length >= 35);
});
