import { execSync } from "node:child_process";

export type ChangedFile = {
  path: string;
  status: "modified" | "added" | "deleted";
};

export function isGitRepo(root: string): boolean {
  try {
    execSync("git rev-parse --git-dir", { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function getChangedFiles(root: string): ChangedFile[] {
  const output = execSync("git diff --name-status HEAD", { cwd: root, encoding: "utf8" });
  const staged = execSync("git diff --name-status --cached", { cwd: root, encoding: "utf8" });

  const files: ChangedFile[] = [];

  for (const line of (output + staged).split(/\r?\n/).filter(Boolean)) {
    const parts = line.split(/\s+/);
    const status = parts[0];
    const path = parts.slice(1).join(" ");

    if (status === "M") {
      files.push({ path, status: "modified" });
    } else if (status === "A") {
      files.push({ path, status: "added" });
    } else if (status === "D") {
      files.push({ path, status: "deleted" });
    }
  }

  return files;
}

export function getFileContentAtRef(ref: string, filePath: string, root: string): string | null {
  try {
    return execSync(`git show "${ref}:${filePath}"`, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

export function listFilesAtRef(ref: string, root: string): string[] {
  try {
    const output = execSync(`git ls-tree -r --name-only "${ref}"`, { cwd: root, encoding: "utf8" });
    return output.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}
