import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { addEntry, listEntries, removeEntry } from "./managedBlock.js";
import { isTracked } from "./git.js";

/** Path to a repo's local (uncommitted) exclude file. */
export function excludeFile(root: string): string {
  return join(root, ".git", "info", "exclude");
}

/** Path to the repo-root `.ignore` (read by ripgrep, ignored by git). */
export function ignoreFile(root: string): string {
  return join(root, ".ignore");
}

const IGNORE_REL = ".ignore";

/**
 * Locally hide an untracked path from git while keeping it visible to ripgrep/Claude:
 *  - add the path to `.git/info/exclude`  → git stops listing it
 *  - add `!path` to `.ignore`             → ripgrep re-includes it
 *  - if `.ignore` is itself untracked, hide `.ignore` from git too
 */
export function ignoreUntracked(root: string, relPath: string): void {
  addEntry(excludeFile(root), relPath);
  addEntry(ignoreFile(root), `!${relPath}`);

  if (!isTracked(root, IGNORE_REL)) {
    addEntry(excludeFile(root), IGNORE_REL);
  }
}

/** Reverse {@link ignoreUntracked}. Cleans up `.ignore` bookkeeping when it empties out. */
export function unignoreUntracked(root: string, relPath: string): void {
  removeEntry(excludeFile(root), relPath);
  removeEntry(ignoreFile(root), `!${relPath}`);

  // If no negations remain, stop hiding `.ignore` and remove it if we left it empty.
  const ignore = ignoreFile(root);
  if (listEntries(ignore).length === 0) {
    removeEntry(excludeFile(root), IGNORE_REL);
    if (existsSync(ignore) && readFileSync(ignore, "utf8").trim() === "") {
      rmSync(ignore);
    }
  }
}

/** Repo-relative paths currently locally-ignored via the exclude/`.ignore` mechanism. */
export function listUntrackedIgnored(root: string): string[] {
  return listEntries(excludeFile(root)).filter((e) => e !== IGNORE_REL);
}
