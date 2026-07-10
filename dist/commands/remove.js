import { isTracked, listSkipWorktree, repoRoot, toRepoRelative, unsetSkipWorktree, } from "../git.js";
import { listUntrackedIgnored, unignoreUntracked } from "../localIgnore.js";
export function remove(paths) {
    if (paths.length === 0) {
        throw new Error("usage: gil rm <path...>");
    }
    const root = repoRoot();
    const skipped = new Set(listSkipWorktree(root));
    const untracked = new Set(listUntrackedIgnored(root));
    for (const p of paths) {
        const rel = toRepoRelative(root, p);
        if (skipped.has(rel) && isTracked(root, rel)) {
            unsetSkipWorktree(root, rel);
            console.log(`restored (skip-worktree cleared):  ${rel}`);
            continue;
        }
        if (untracked.has(rel)) {
            unignoreUntracked(root, rel);
            console.log(`restored (exclude + .ignore cleared):  ${rel}`);
            continue;
        }
        console.warn(`not locally ignored by gil:  ${rel}`);
    }
}
//# sourceMappingURL=remove.js.map