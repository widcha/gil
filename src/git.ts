import { execFileSync } from "node:child_process";
import { relative, resolve, sep } from "node:path";

export class GitError extends Error {}

/** Run a git command, returning trimmed stdout. Throws GitError on failure. */
function git(args: string[], cwd?: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const stderr = e.stderr ? e.stderr.toString().trim() : "";
    throw new GitError(stderr || e.message || `git ${args.join(" ")} failed`);
  }
}

/** Absolute path to the working-tree root, or throws if not in a git repo. */
export function repoRoot(cwd = process.cwd()): string {
  try {
    return git(["rev-parse", "--show-toplevel"], cwd);
  } catch {
    throw new GitError("not inside a git repository");
  }
}

/** Convert any path (absolute or relative to cwd) into a repo-root-relative POSIX path. */
export function toRepoRelative(root: string, p: string, cwd = process.cwd()): string {
  const abs = resolve(cwd, p);
  const rel = relative(root, abs);
  if (rel === "" || rel.startsWith("..")) {
    throw new GitError(`path is outside the repository: ${p}`);
  }
  return rel.split(sep).join("/");
}

/** True if the path is tracked in the git index. */
export function isTracked(root: string, relPath: string): boolean {
  try {
    git(["ls-files", "--error-unmatch", "--", relPath], root);
    return true;
  } catch {
    return false;
  }
}

export function setSkipWorktree(root: string, relPath: string): void {
  git(["update-index", "--skip-worktree", "--", relPath], root);
}

export function unsetSkipWorktree(root: string, relPath: string): void {
  git(["update-index", "--no-skip-worktree", "--", relPath], root);
}

/**
 * Repo-relative paths currently flagged skip-worktree.
 * `git ls-files -v` prefixes skip-worktree entries with a capital `S`.
 */
export function listSkipWorktree(root: string): string[] {
  const out = git(["ls-files", "-v"], root);
  if (!out) return [];
  return out
    .split("\n")
    .filter((line) => line.startsWith("S "))
    .map((line) => line.slice(2));
}
