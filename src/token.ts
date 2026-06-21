import { readFileSync } from "node:fs";

export type TokenEstimate = {
  tokens: number;
  skipped: boolean;
};

export function estimateFileTokens(path: string): TokenEstimate {
  const buffer = readFileSync(path);

  if (looksBinary(buffer)) {
    return { tokens: 0, skipped: true };
  }

  const content = buffer.toString("utf8");
  return {
    tokens: estimateTextTokens(content),
    skipped: false,
  };
}

export function estimateTextTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

function looksBinary(buffer: Buffer): boolean {
  if (buffer.includes(0)) {
    return true;
  }

  const sampleSize = Math.min(buffer.length, 1024);
  if (sampleSize === 0) {
    return false;
  }

  let suspiciousBytes = 0;

  for (let index = 0; index < sampleSize; index += 1) {
    const byte = buffer[index];
    const isCommonTextByte = byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 128;

    if (!isCommonTextByte) {
      suspiciousBytes += 1;
    }
  }

  return suspiciousBytes / sampleSize > 0.3;
}
