import { listSkipWorktree, repoRoot } from "../git.js";
import { listUntrackedIgnored } from "../localIgnore.js";
import { restoreOne } from "./remove.js";

export function removeAll(): void {
  const root = repoRoot();
  const tracked = listSkipWorktree(root);
  const untracked = listUntrackedIgnored(root);

  const all = [...untracked, ...tracked];
  if (all.length === 0) {
    console.log("nothing is locally ignored by gil");
    return;
  }

  const skippedSet = new Set(tracked);
  const untrackedSet = new Set(untracked);

  let restored = 0;
  for (const rel of all) {
    if (restoreOne(root, rel, skippedSet, untrackedSet)) restored++;
  }
  console.log(`\n${restored} file(s) restored`);
}
