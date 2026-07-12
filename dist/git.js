import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
export class GitError extends Error {
}
/** Run a git command, returning trimmed stdout. Throws GitError on failure. */
function git(args, cwd) {
    try {
        return execFileSync("git", args, {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        }).trim();
    }
    catch (err) {
        const e = err;
        const stderr = e.stderr ? e.stderr.toString().trim() : "";
        throw new GitError(stderr || e.message || `git ${args.join(" ")} failed`);
    }
}
/** Like git(), but returns raw stdout (no trim) — needed for NUL-delimited (-z) output. */
function gitRaw(args, cwd) {
    try {
        return execFileSync("git", args, {
            cwd,
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
            stdio: ["ignore", "pipe", "pipe"],
        });
    }
    catch (err) {
        const e = err;
        const stderr = e.stderr ? e.stderr.toString().trim() : "";
        throw new GitError(stderr || e.message || `git ${args.join(" ")} failed`);
    }
}
/** Split NUL-delimited git output into tokens, dropping the trailing empty. */
function splitZ(out) {
    const parts = out.split("\0");
    if (parts.length && parts[parts.length - 1] === "")
        parts.pop();
    return parts;
}
/** Absolute path to the working-tree root, or throws if not in a git repo. */
export function repoRoot(cwd = process.cwd()) {
    try {
        return git(["rev-parse", "--show-toplevel"], cwd);
    }
    catch {
        throw new GitError("not inside a git repository");
    }
}
/** Convert any path (absolute or relative to cwd) into a repo-root-relative POSIX path. */
export function toRepoRelative(root, p, cwd = process.cwd()) {
    const abs = resolve(cwd, p);
    const rel = relative(root, abs);
    if (rel === "" || rel.startsWith("..")) {
        throw new GitError(`path is outside the repository: ${p}`);
    }
    return rel.split(sep).join("/");
}
/** True if the path is tracked in the git index. */
export function isTracked(root, relPath) {
    try {
        git(["ls-files", "--error-unmatch", "--", relPath], root);
        return true;
    }
    catch {
        return false;
    }
}
export function setSkipWorktree(root, relPath) {
    git(["update-index", "--skip-worktree", "--", relPath], root);
}
export function unsetSkipWorktree(root, relPath) {
    git(["update-index", "--no-skip-worktree", "--", relPath], root);
}
/**
 * Repo-relative paths currently flagged skip-worktree.
 * `git ls-files -v` prefixes skip-worktree entries with a capital `S`.
 */
export function listSkipWorktree(root) {
    const out = git(["ls-files", "-v"], root);
    if (!out)
        return [];
    return out
        .split("\n")
        .filter((line) => line.startsWith("S "))
        .map((line) => line.slice(2));
}
/**
 * Repo-relative paths of the current changes — everything `git status` would show:
 *  - untracked files (listed individually, never collapsed into a directory), and
 *  - tracked files with staged or unstaged modifications (rename targets included).
 * Deletions and directories are excluded (nothing on disk to keep visible to `@`).
 */
export function listChangedPaths(root) {
    // Untracked files, expanded to individual paths (honors .gitignore + .git/info/exclude).
    const untracked = splitZ(gitRaw(["ls-files", "--others", "--exclude-standard", "-z"], root));
    // Tracked changes from porcelain -z; take the target path, skip untracked (handled above).
    const status = splitZ(gitRaw(["status", "--porcelain", "-z"], root));
    const tracked = [];
    for (let i = 0; i < status.length; i++) {
        const entry = status[i];
        if (entry.length < 3)
            continue;
        const [x, y] = [entry[0], entry[1]];
        const path = entry.slice(3);
        // Rename/copy entries are followed by the source path in a separate token; skip it.
        if (x === "R" || x === "C" || y === "R" || y === "C")
            i++;
        if (x === "?")
            continue; // untracked, already collected
        if (existsSync(join(root, path)))
            tracked.push(path); // excludes deletions
    }
    const seen = new Set();
    const out = [];
    for (const p of [...untracked, ...tracked]) {
        if (!seen.has(p)) {
            seen.add(p);
            out.push(p);
        }
    }
    return out;
}
//# sourceMappingURL=git.js.map