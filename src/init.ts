import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { CONFIG_FILE_NAME, DEFAULT_CONFIG } from "./config.js";

export type InitResult = {
  path: string;
};

export class InitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitError";
  }
}

export function initConfig(cwd = process.cwd()): InitResult {
  const path = resolve(cwd, CONFIG_FILE_NAME);

  if (existsSync(path)) {
    throw new InitError(`${CONFIG_FILE_NAME} already exists`);
  }

  writeFileSync(path, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");

  return { path };
}
