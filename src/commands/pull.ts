import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  hasLocalChanges,
  listSkipWorktree,
  repoRoot,
  runGitInherit,
  setSkipWorktree,
  unmergedPaths,
  unsetSkipWorktree,
} from "../git.js";

/**
 * `git pull` that survives skip-worktree'd files.
 *
 * A giled (skip-worktree) file with local edits makes `git pull` abort when
 * upstream also changed it. This lifts those files, stashes their local edits,
 * pulls, restores the edits, then re-giles everything that merged cleanly.
 * Files that hit a real merge conflict are left un-giled for you to resolve.
 */
export function pull(args: string[]): void {
  const root = repoRoot();
  const saved = listSkipWorktree(root);

  // Nothing giled → just a normal pull.
  if (saved.length === 0) {
    process.exitCode = runGitInherit(["pull", ...args], root);
    return;
  }

  console.log(`gil: temporarily lifting ${saved.length} giled file(s) for pull…`);
  for (const f of saved) unsetSkipWorktree(root, f);

  let stashed = false;
  if (hasLocalChanges(root, saved)) {
    const code = runGitInherit(
      ["stash", "push", "--quiet", "-m", "gil-pull", "--", ...saved],
      root,
    );
    stashed = code === 0;
    if (stashed) console.log("gil: stashed your local edits to those files");
  }

  const pullCode = runGitInherit(["pull", ...args], root);

  if (stashed) {
    console.log("gil: restoring your local edits…");
    runGitInherit(["stash", "pop"], root); // may conflict — output shown to user
  }

  // Re-gile files that still exist and merged cleanly; leave conflicts for the user.
  const conflicted = new Set(unmergedPaths(root));
  const reGiled: string[] = [];
  const needResolve: string[] = [];
  for (const f of saved) {
    if (!existsSync(join(root, f))) continue; // removed upstream
    if (conflicted.has(f)) {
      needResolve.push(f);
      continue;
    }
    setSkipWorktree(root, f);
    reGiled.push(f);
  }

  console.log(`\ngil: re-giled ${reGiled.length} file(s)`);
  if (needResolve.length > 0) {
    console.log("gil: left un-giled due to merge conflicts — resolve, then re-run `gil add`:");
    for (const f of needResolve) console.log(`  ${f}`);
  }

  // Signal that action is needed: non-zero on pull failure or unresolved conflicts.
  if (pullCode !== 0) process.exitCode = pullCode;
  else if (needResolve.length > 0) process.exitCode = 1;
}
