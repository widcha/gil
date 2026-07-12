import { listChangedPaths, repoRoot } from "../git.js";
import { ignoreOne } from "./add.js";

export function addAll(): void {
  const root = repoRoot();
  const paths = listChangedPaths(root);

  if (paths.length === 0) {
    console.log("no current changes to ignore");
    return;
  }

  let ignored = 0;
  for (const rel of paths) {
    if (ignoreOne(root, rel)) ignored++;
  }
  console.log(`\n${ignored} file(s) locally ignored out of ${paths.length} change(s)`);
}
