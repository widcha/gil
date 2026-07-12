# gil — git ignore, local

Locally hide files from git **without** committing to `.gitignore`, while keeping them fully
visible to Claude Code's `@` file references (and ripgrep-based tooling).

## Why

`.gitignore` is committed and shared with everyone. Sometimes you want a purely **local** ignore —
a secret, a scratch file, or local-only edits to a tracked file — that git never surfaces but that
your tools (like Claude's `@`) can still read.

The catch: the usual local-ignore mechanisms (`.git/info/exclude`) also hide the file from ripgrep,
which is what Claude's file search is built on. `gil` solves both halves.

## How it works

| File state | Hide from git | Keep visible to `@` / ripgrep |
|---|---|---|
| **Untracked** | add to `.git/info/exclude` | add `!path` to a repo-root `.ignore` (ripgrep reads it, git doesn't) |
| **Tracked**   | `git update-index --skip-worktree` | nothing needed — no ignore entry is created |

All state lives inside git itself (marker-delimited blocks in `.git/info/exclude` / `.ignore`, and
git's own skip-worktree flag), so `gil` keeps no database and never touches your committed files.

## Install

From the npm registry (the package is named `gilocal`; the command it installs is `gil`):

```bash
npm install -g gilocal
```

> **Why `gilocal` and not `gil`?** The bare name `gil` was already taken on npm. And
> `npm install -g widcha/gil` (the GitHub shorthand) doesn't work for global installs —
> npm symlinks it to a temporary cache clone it then deletes, leaving a broken command.

### Alternative: straight from GitHub

```bash
npm install -g https://github.com/widcha/gil/tarball/main
```

### From source (development)

```bash
git clone https://github.com/widcha/gil.git
cd gil
npm install       # runs the build via the prepare script
npm link          # exposes the `gil` command globally
```

Or run without installing: `npm run dev -- <args>` (e.g. `npm run dev -- add secret.local`).

## Usage

```bash
gil add <path...>      # locally ignore file(s)
gil add-all            # locally ignore everything in the current changes
gil rm  <path...>      # undo
gil rm-all             # undo everything gil is ignoring (restore all)
gil list               # what gil is currently ignoring
gil status [path...]   # per-file: hidden from git? visible to rg?
gil pull [args...]     # git pull that survives giled files (see below)
gil help
```

### Pulling upstream changes

A giled **tracked** file (skip-worktree) makes a plain `git pull` **abort** if upstream
also changed that file:

```
error: Your local changes to the following files would be overwritten by merge:
	config.json
Aborting
```

`gil pull` handles this for you — it lifts the skip-worktree files, stashes your local
edits, runs `git pull` (passing through any args), restores your edits, then re-giles
everything that merged cleanly:

```bash
gil pull                 # instead of: git pull
gil pull origin main     # args pass straight through to git pull
```

- If upstream didn't touch your giled files, it's completely seamless.
- If upstream **did** change a giled file, you get a normal merge conflict to resolve.
  gil leaves that file un-giled; fix the conflict, then `gil add` it again.
- Untracked giled files (exclude + `.ignore`) are invisible to git, so pull never
  touches them — they're always safe.

Example:

```bash
gil add secret.local
git status             # secret.local does NOT appear
# In Claude Code:  @secret.local  ->  still listed and readable
```

## Limitations

- **Files, not directories.** ripgrep/git cannot re-include a file whose parent directory is
  excluded, so the `.ignore` trick can't keep a whole directory's contents visible to `@`. `gil`
  warns and skips directories — ignore individual files instead.
- **`skip-worktree` caveat.** For tracked files, a plain `git pull` aborts when upstream changed a
  giled file. Use **`gil pull`** (above) instead — it lifts, pulls, and re-giles automatically.
- Operates on the repository root's `.ignore` and that repo's `.git/info/exclude` (no nested or
  global-ignore handling).

## Notes on Claude Code's `@`

Claude's `@` picker is Glob-powered and by default does **not** honor ignore rules
(`CLAUDE_CODE_GLOB_NO_IGNORE=true`), so it often sees excluded files anyway. The `.ignore` negation
makes visibility robust even if you set `CLAUDE_CODE_GLOB_NO_IGNORE=false`.
