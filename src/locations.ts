export type Location = {
  line: number;
  column: number;
};

export function locationFromOffset(content: string, offset: number): Location {
  const safeOffset = Math.max(0, Math.min(offset, content.length));
  let line = 1;
  let column = 1;

  for (let index = 0; index < safeOffset; index += 1) {
    if (content[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

export function firstRegexLocation(content: string, pattern: RegExp): Location | undefined {
  const match = pattern.exec(content);
  if (!match || match.index === undefined) {
    return undefined;
  }

  return locationFromOffset(content, match.index);
}
