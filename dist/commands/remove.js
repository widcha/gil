import { isTracked, listSkipWorktree, repoRoot, toRepoRelative, unsetSkipWorktree, } from "../git.js";
import { listUntrackedIgnored, unignoreUntracked } from "../localIgnore.js";
/**
 * Undo a local ignore for one repo-relative path, given the current sets of
 * skip-worktree and exclude/.ignore entries. Returns true if it restored anything.
 */
export function restoreOne(root, rel, skipped, untracked) {
    if (skipped.has(rel) && isTracked(root, rel)) {
        unsetSkipWorktree(root, rel);
        console.log(`restored (skip-worktree cleared):  ${rel}`);
        return true;
    }
    if (untracked.has(rel)) {
        unignoreUntracked(root, rel);
        console.log(`restored (exclude + .ignore cleared):  ${rel}`);
        return true;
    }
    console.warn(`not locally ignored by gil:  ${rel}`);
    return false;
}
export function remove(paths) {
    if (paths.length === 0) {
        throw new Error("usage: gil rm <path...>");
    }
    const root = repoRoot();
    const skipped = new Set(listSkipWorktree(root));
    const untracked = new Set(listUntrackedIgnored(root));
    for (const p of paths) {
        restoreOne(root, toRepoRelative(root, p), skipped, untracked);
    }
}
//# sourceMappingURL=remove.js.map