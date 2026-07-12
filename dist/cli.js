#!/usr/bin/env node
import { add } from "./commands/add.js";
import { addAll } from "./commands/addAll.js";
import { remove } from "./commands/remove.js";
import { list } from "./commands/list.js";
import { status } from "./commands/status.js";
import { GitError } from "./git.js";
const HELP = `gil — locally ignore files from git while keeping them visible to Claude's @

Usage:
  gil add <path...>     Locally ignore file(s): git stops tracking changes, but
                        ripgrep/Claude's @ can still see and read them.
  gil add-all           Locally ignore every file in the current changes
                        (untracked files + tracked modifications).
  gil rm  <path...>     Undo a local ignore.
  gil list              List everything gil is locally ignoring.
  gil status [path...]  Diagnose each ignored file (hidden from git? visible to rg?).
  gil help              Show this help.

Mechanism:
  tracked files    -> git update-index --skip-worktree  (no ignore entry, @ unaffected)
  untracked files  -> .git/info/exclude  +  .ignore negation  (git hides, rg re-reveals)

All changes are local to your clone and never committed.`;
function main(argv) {
    const [cmd, ...rest] = argv;
    switch (cmd) {
        case "add":
            add(rest);
            return 0;
        case "add-all":
        case "addall":
            addAll();
            return 0;
        case "rm":
        case "remove":
            remove(rest);
            return 0;
        case "list":
        case "ls":
            list();
            return 0;
        case "status":
            status(rest);
            return 0;
        case "help":
        case "--help":
        case "-h":
        case undefined:
            console.log(HELP);
            return 0;
        default:
            console.error(`unknown command: ${cmd}\n`);
            console.error(HELP);
            return 2;
    }
}
try {
    process.exit(main(process.argv.slice(2)));
}
catch (err) {
    if (err instanceof GitError) {
        console.error(`gil: ${err.message}`);
    }
    else {
        console.error(`gil: ${err.message}`);
    }
    process.exit(1);
}
//# sourceMappingURL=cli.js.map