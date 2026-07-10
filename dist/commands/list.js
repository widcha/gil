import { listSkipWorktree, repoRoot } from "../git.js";
import { listUntrackedIgnored } from "../localIgnore.js";
export function list() {
    const root = repoRoot();
    const untracked = listUntrackedIgnored(root);
    const tracked = listSkipWorktree(root);
    if (untracked.length === 0 && tracked.length === 0) {
        console.log("no files are locally ignored by gil");
        return;
    }
    if (untracked.length > 0) {
        console.log("untracked (via .git/info/exclude + .ignore):");
        for (const f of untracked)
            console.log(`  ${f}`);
    }
    if (tracked.length > 0) {
        console.log("tracked (via git skip-worktree):");
        for (const f of tracked)
            console.log(`  ${f}`);
    }
}
//# sourceMappingURL=list.js.map