import { execFileSync } from "node:child_process";
import { listSkipWorktree, repoRoot, toRepoRelative } from "../git.js";
import { listUntrackedIgnored } from "../localIgnore.js";
/** Does `git status --porcelain` currently surface this path? (true = git can still see it) */
function gitShows(root, rel) {
    const out = execFileSync("git", ["status", "--porcelain", "--", rel], {
        cwd: root,
        encoding: "utf8",
    }).trim();
    return out !== "";
}
/** Does ripgrep's file walk surface this path? null = rg not installed. */
function ripgrepShows(root, rel) {
    try {
        const out = execFileSync("rg", ["--files", "-g", rel], {
            cwd: root,
            encoding: "utf8",
        }).trim();
        return out !== "";
    }
    catch (err) {
        const code = err.status;
        // rg exits 1 when no files match (a valid "not visible" answer).
        if (code === 1)
            return false;
        if (err.code === "ENOENT")
            return null;
        return false;
    }
}
function report(root, rel, mechanism) {
    const git = gitShows(root, rel);
    const rg = ripgrepShows(root, rel);
    const rgLabel = rg === null ? "rg not installed" : rg ? "yes" : "NO";
    console.log(`  ${rel}`);
    console.log(`      mechanism:        ${mechanism}`);
    console.log(`      hidden from git:  ${git ? "NO (still visible!)" : "yes"}`);
    console.log(`      visible to rg/@:  ${rgLabel}`);
}
export function status(paths) {
    const root = repoRoot();
    const untracked = new Set(listUntrackedIgnored(root));
    const tracked = new Set(listSkipWorktree(root));
    const targets = paths.length > 0
        ? paths.map((p) => toRepoRelative(root, p))
        : [...untracked, ...tracked];
    if (targets.length === 0) {
        console.log("no files are locally ignored by gil");
        return;
    }
    for (const rel of targets) {
        if (untracked.has(rel)) {
            report(root, rel, "exclude + .ignore (untracked)");
        }
        else if (tracked.has(rel)) {
            report(root, rel, "skip-worktree (tracked)");
        }
        else {
            console.log(`  ${rel}`);
            console.log(`      mechanism:        not locally ignored by gil`);
        }
    }
}
//# sourceMappingURL=status.js.map