export function unifiedDiff(before: string, after: string, filePath: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const header = `--- a/${filePath}\n+++ b/${filePath}`;
  const hunks = computeHunks(beforeLines, afterLines);

  if (hunks.length === 0) {
    return "";
  }

  return [header, ...hunks.flatMap((hunk) => formatHunk(hunk))].join("\n");
}

type Hunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: HunkLine[];
};

type HunkLine = { kind: "equal"; content: string } | { kind: "add"; content: string } | { kind: "remove"; content: string };

function computeHunks(before: string[], after: string[]): Hunk[] {
  const lcs = buildLcsTable(before, after);
  const diff = backtrack(before, after, before.length, after.length, lcs);

  if (diff.every((d) => d.kind === "equal")) {
    return [];
  }

  return chunkIntoHunks(diff);
}

function buildLcsTable(before: string[], after: string[]): number[][] {
  const m = before.length;
  const n = after.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = before[i - 1] === after[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp;
}

function backtrack(
  before: string[],
  after: string[],
  i: number,
  j: number,
  dp: number[][],
): HunkLine[] {
  const result: HunkLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && before[i - 1] === after[j - 1]) {
      result.push({ kind: "equal", content: before[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ kind: "add", content: after[j - 1] });
      j--;
    } else {
      result.push({ kind: "remove", content: before[i - 1] });
      i--;
    }
  }

  return result.reverse();
}

const CONTEXT_LINES = 3;

function chunkIntoHunks(diff: HunkLine[]): Hunk[] {
  const hunks: Hunk[] = [];
  let start = 0;

  while (start < diff.length) {
    while (start < diff.length && diff[start].kind === "equal") {
      start++;
    }

    if (start >= diff.length) {
      break;
    }

    const hunkStart = Math.max(0, start - CONTEXT_LINES);
    let end = start;

    while (end < diff.length) {
      end++;
      if (end < diff.length && diff[end].kind === "equal") {
        let contextEnd = end;
        while (contextEnd < diff.length && diff[contextEnd].kind === "equal") {
          contextEnd++;
        }
        if (contextEnd - end > CONTEXT_LINES * 2) {
          end = end + CONTEXT_LINES;
          break;
        }
        end = contextEnd;
      }
    }

    const hunkLines = diff.slice(hunkStart, end);
    const oldLines = hunkLines.filter((l) => l.kind !== "add").length;
    const newLines = hunkLines.filter((l) => l.kind !== "remove").length;

    const oldStart = hunkStart + 1;
    const newStart = hunkStart + 1;

    hunks.push({
      oldStart,
      oldLines,
      newStart,
      newLines,
      lines: hunkLines,
    });

    start = end;
  }

  return hunks;
}

function formatHunk(hunk: Hunk): string[] {
  const result: string[] = [
    `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
  ];

  for (const line of hunk.lines) {
    switch (line.kind) {
      case "equal":
        result.push(` ${line.content}`);
        break;
      case "add":
        result.push(`+${line.content}`);
        break;
      case "remove":
        result.push(`-${line.content}`);
        break;
    }
  }

  return result;
}
