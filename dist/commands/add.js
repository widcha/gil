import { statSync } from "node:fs";
import { join } from "node:path";
import { isTracked, repoRoot, setSkipWorktree, toRepoRelative, } from "../git.js";
import { ignoreUntracked } from "../localIgnore.js";
/**
 * Locally ignore a single repo-relative path, picking the mechanism by tracked state.
 * Returns true if the path was ignored, false if it was skipped (a directory).
 */
export function ignoreOne(root, rel) {
    let isDir = false;
    try {
        isDir = statSync(join(root, rel)).isDirectory();
    }
    catch {
        // path may not exist on disk (e.g. tracked-but-deleted); treat as file.
    }
    if (isTracked(root, rel)) {
        setSkipWorktree(root, rel);
        console.log(`ignored (tracked, skip-worktree):  ${rel}`);
        return true;
    }
    if (isDir) {
        console.warn(`skipped ${rel}: directories are not supported — ripgrep cannot re-reveal ` +
            `files under an excluded directory, so '@' would break. Ignore individual files instead.`);
        return false;
    }
    ignoreUntracked(root, rel);
    console.log(`ignored (untracked, exclude + .ignore):  ${rel}`);
    return true;
}
export function add(paths) {
    if (paths.length === 0) {
        throw new Error("usage: gil add <path...>");
    }
    const root = repoRoot();
    for (const p of paths) {
        ignoreOne(root, toRepoRelative(root, p));
    }
}
//# sourceMappingURL=add.js.map