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

Install straight from GitHub (no npm registry needed) — this builds the TypeScript
automatically via the `prepare` script and puts the `gil` command on your PATH:

```bash
npm install -g widcha/gil
```

To install a specific version/tag: `npm install -g widcha/gil#v0.1.0`.

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
gil rm  <path...>      # undo
gil list               # what gil is currently ignoring
gil status [path...]   # per-file: hidden from git? visible to rg?
gil help
```

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
- **`skip-worktree` caveat.** For tracked files, `git pull`/merge across a skip-worktree entry can
  conflict or silently drop your local edits. Standard git behavior; use `gil rm` before pulling if
  you expect upstream changes to that file.
- Operates on the repository root's `.ignore` and that repo's `.git/info/exclude` (no nested or
  global-ignore handling).

## Notes on Claude Code's `@`

Claude's `@` picker is Glob-powered and by default does **not** honor ignore rules
(`CLAUDE_CODE_GLOB_NO_IGNORE=true`), so it often sees excluded files anyway. The `.ignore` negation
makes visibility robust even if you set `CLAUDE_CODE_GLOB_NO_IGNORE=false`.
