import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { CtxscopeConfig, RuleSeverity } from "./types.js";

export const CONFIG_FILE_NAME = "ctxscope.config.json";

export const DEFAULT_CONFIG: CtxscopeConfig = {
  maxTokens: 8000,
  maxFileTokens: 2500,
  ignore: ["node_modules", "dist", ".git"],
  rules: {
    CTX001: "warn",
    CTX002: "warn",
    CTX003: "warn",
    CTX004: "warn",
    CTX005: "warn",
    CTX006: "warn",
    CTX101: "error",
    CTX102: "error",
    CTX105: "error",
  },
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadConfig(cwd = process.cwd()): CtxscopeConfig {
  const configPath = resolve(cwd, CONFIG_FILE_NAME);

  if (!existsSync(configPath)) {
    return structuredClone(DEFAULT_CONFIG);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown parse error";
    throw new ConfigError(`${CONFIG_FILE_NAME} is not valid JSON: ${message}`);
  }

  return normalizeConfig(parsed);
}

function normalizeConfig(value: unknown): CtxscopeConfig {
  if (!isObject(value)) {
    throw new ConfigError(`${CONFIG_FILE_NAME} must contain a JSON object`);
  }

  return {
    maxTokens: readPositiveNumber(value, "maxTokens", DEFAULT_CONFIG.maxTokens),
    maxFileTokens: readPositiveNumber(value, "maxFileTokens", DEFAULT_CONFIG.maxFileTokens),
    ignore: readStringArray(value, "ignore", DEFAULT_CONFIG.ignore),
    rules: {
      ...DEFAULT_CONFIG.rules,
      ...readRules(value),
    },
  };
}

function readPositiveNumber(value: Record<string, unknown>, key: string, fallback: number): number {
  const field = value[key];

  if (field === undefined) {
    return fallback;
  }

  if (typeof field !== "number" || !Number.isFinite(field) || field <= 0) {
    throw new ConfigError(`${CONFIG_FILE_NAME}.${key} must be a positive number`);
  }

  return field;
}

function readStringArray(value: Record<string, unknown>, key: string, fallback: string[]): string[] {
  const field = value[key];

  if (field === undefined) {
    return [...fallback];
  }

  if (!Array.isArray(field) || field.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new ConfigError(`${CONFIG_FILE_NAME}.${key} must be an array of non-empty strings`);
  }

  return [...field];
}

function readRules(value: Record<string, unknown>): Record<string, RuleSeverity> {
  const field = value.rules;

  if (field === undefined) {
    return {};
  }

  if (!isObject(field)) {
    throw new ConfigError(`${CONFIG_FILE_NAME}.rules must be an object`);
  }

  const rules: Record<string, RuleSeverity> = {};

  for (const [code, severity] of Object.entries(field)) {
    if (!isRuleSeverity(severity)) {
      throw new ConfigError(`${CONFIG_FILE_NAME}.rules.${code} must be one of: off, warn, error`);
    }

    rules[code] = severity;
  }

  return rules;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuleSeverity(value: unknown): value is RuleSeverity {
  return value === "off" || value === "warn" || value === "error";
}
