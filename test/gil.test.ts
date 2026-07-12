import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const TSX = fileURLToPath(new URL("../node_modules/.bin/tsx", import.meta.url));

let repo: string;

function gil(...args: string[]): string {
  const r = spawnSync(TSX, [CLI, ...args], { cwd: repo, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`gil ${args.join(" ")} exited ${r.status}: ${r.stderr}`);
  }
  return (r.stdout ?? "") + (r.stderr ?? "");
}

/** Run gil in a given cwd without throwing on non-zero exit. */
function gilAt(cwd: string, ...args: string[]): { code: number; out: string } {
  const r = spawnSync(TSX, [CLI, ...args], { cwd, encoding: "utf8" });
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}
function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}
function rgFiles(): string[] {
  const out = execFileSync("rg", ["--files"], { cwd: repo, encoding: "utf8" }).trim();
  return out ? out.split("\n") : [];
}
function statusPorcelain(): string {
  return git("status", "--porcelain");
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "gil-test-"));
  git("init", "-q");
  git("config", "user.email", "t@t.dev");
  git("config", "user.name", "t");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("untracked files", () => {
  it("hides from git status but keeps visible to ripgrep", () => {
    writeFileSync(join(repo, "secret.local"), "shh");
    writeFileSync(join(repo, "normal.txt"), "hi");

    gil("add", "secret.local");

    expect(statusPorcelain()).not.toMatch(/secret\.local/);
    expect(statusPorcelain()).toMatch(/normal\.txt/); // untouched file still shows
    expect(rgFiles()).toContain("secret.local"); // '@' promise: rg still sees it
  });

  it("also hides the .ignore helper file from git", () => {
    writeFileSync(join(repo, "secret.local"), "shh");
    gil("add", "secret.local");
    expect(existsSync(join(repo, ".ignore"))).toBe(true);
    expect(statusPorcelain()).not.toMatch(/\.ignore/);
  });

  it("is idempotent — adding twice does not duplicate lines", () => {
    writeFileSync(join(repo, "secret.local"), "shh");
    gil("add", "secret.local");
    gil("add", "secret.local");
    const exclude = readFileSync(join(repo, ".git/info/exclude"), "utf8");
    const ignore = readFileSync(join(repo, ".ignore"), "utf8");
    expect(exclude.match(/^secret\.local$/gm)?.length).toBe(1);
    expect(ignore.match(/^!secret\.local$/gm)?.length).toBe(1);
  });

  it("rm fully restores git visibility and removes .ignore bookkeeping", () => {
    writeFileSync(join(repo, "secret.local"), "shh");
    gil("add", "secret.local");
    gil("rm", "secret.local");

    expect(statusPorcelain()).toMatch(/secret\.local/); // git sees it again
    expect(existsSync(join(repo, ".ignore"))).toBe(false); // helper cleaned up
  });

  it("warns and skips directories", () => {
    execFileSync("mkdir", [join(repo, "sub")]);
    writeFileSync(join(repo, "sub/a.txt"), "a");
    const out = gil("add", "sub");
    expect(out).toMatch(/directories are not supported/);
    expect(existsSync(join(repo, ".ignore"))).toBe(false);
  });
});

describe("tracked files", () => {
  beforeEach(() => {
    writeFileSync(join(repo, "config.json"), '{"a":1}');
    git("add", "config.json");
    git("commit", "-qm", "init");
  });

  it("hides local edits via skip-worktree while rg still sees the file", () => {
    writeFileSync(join(repo, "config.json"), '{"a":2}'); // local edit
    gil("add", "config.json");

    expect(statusPorcelain()).toBe(""); // git reports no change
    expect(rgFiles()).toContain("config.json");
    expect(gil("list")).toMatch(/config\.json/);
  });

  it("rm clears skip-worktree so edits reappear", () => {
    writeFileSync(join(repo, "config.json"), '{"a":2}');
    gil("add", "config.json");
    gil("rm", "config.json");
    expect(statusPorcelain()).toMatch(/config\.json/);
  });
});

describe("add-all", () => {
  it("ignores untracked files and tracked modifications in one shot", () => {
    // a committed file we then modify locally
    writeFileSync(join(repo, "tracked.txt"), "v1");
    git("add", "tracked.txt");
    git("commit", "-qm", "init");
    writeFileSync(join(repo, "tracked.txt"), "v2"); // unstaged modification

    // untracked files, including one nested in a new directory
    writeFileSync(join(repo, "a.local"), "a");
    execFileSync("mkdir", [join(repo, "nested")]);
    writeFileSync(join(repo, "nested/b.local"), "b");

    gil("add-all");

    // git now reports a clean tree
    expect(statusPorcelain()).toBe("");
    // every changed file remains visible to ripgrep / '@'
    const files = rgFiles();
    expect(files).toContain("tracked.txt");
    expect(files).toContain("a.local");
    expect(files).toContain("nested/b.local"); // nested untracked file expanded, not a dir
  });

  it("reports when there is nothing to ignore", () => {
    const out = gil("add-all");
    expect(out).toMatch(/no current changes/i);
  });

  it("excludes deletions (nothing on disk to keep visible)", () => {
    writeFileSync(join(repo, "gone.txt"), "x");
    git("add", "gone.txt");
    git("commit", "-qm", "c");
    rmSync(join(repo, "gone.txt"));

    gil("add-all");
    // the deletion is still a real change git should show; add-all must not touch it
    expect(statusPorcelain()).toMatch(/gone\.txt/);
  });
});

describe("rm-all", () => {
  it("restores every ignored file (both mechanisms) at once", () => {
    writeFileSync(join(repo, "tracked.txt"), "v1");
    git("add", "tracked.txt");
    git("commit", "-qm", "init");
    writeFileSync(join(repo, "tracked.txt"), "v2");
    writeFileSync(join(repo, "a.local"), "a");
    writeFileSync(join(repo, "b.local"), "b");

    gil("add-all");
    expect(statusPorcelain()).toBe(""); // all hidden

    gil("rm-all");

    // everything git should see is visible again
    const st = statusPorcelain();
    expect(st).toMatch(/tracked\.txt/);
    expect(st).toMatch(/a\.local/);
    expect(st).toMatch(/b\.local/);
    // gil is now tracking nothing
    expect(gil("list")).toMatch(/no files are locally ignored/i);
    // and the .ignore bookkeeping file is cleaned up
    expect(existsSync(join(repo, ".ignore"))).toBe(false);
  });

  it("reports when there is nothing to restore", () => {
    expect(gil("rm-all")).toMatch(/nothing is locally ignored/i);
  });
});

describe("pull", () => {
  let origin: string;
  let work: string;

  function git2(cwd: string, ...args: string[]): string {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  }

  beforeEach(() => {
    origin = mkdtempSync(join(tmpdir(), "gil-origin-"));
    execFileSync("git", ["init", "-q", "--bare", origin]);

    // seed the origin via a throwaway clone
    const seed = mkdtempSync(join(tmpdir(), "gil-seed-"));
    git2(seed, "clone", "-q", origin, ".");
    git2(seed, "config", "user.email", "t@t.dev");
    git2(seed, "config", "user.name", "t");
    writeFileSync(join(seed, "config.json"), "name=upstream\n");
    writeFileSync(join(seed, "other.txt"), "one\n");
    git2(seed, "add", "-A");
    git2(seed, "commit", "-qm", "init");
    git2(seed, "push", "-q", "origin", "HEAD:main");
    rmSync(seed, { recursive: true, force: true });

    // our working clone
    work = mkdtempSync(join(tmpdir(), "gil-work-"));
    git2(work, "clone", "-q", origin, ".");
    git2(work, "config", "user.email", "t@t.dev");
    git2(work, "config", "user.name", "t");
    git2(work, "checkout", "-q", "-B", "main", "origin/main");
  });

  afterEach(() => {
    rmSync(origin, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  });

  /** Push an upstream commit changing `file` to `content`. */
  function pushUpstream(file: string, content: string): void {
    const s = mkdtempSync(join(tmpdir(), "gil-up-"));
    git2(s, "clone", "-q", origin, ".");
    git2(s, "config", "user.email", "t@t.dev");
    git2(s, "config", "user.name", "t");
    git2(s, "checkout", "-q", "-B", "main", "origin/main");
    writeFileSync(join(s, file), content);
    git2(s, "commit", "-qam", "upstream change");
    git2(s, "push", "-q", "origin", "main");
    rmSync(s, { recursive: true, force: true });
  }

  it("plain git pull aborts when upstream changes a giled file (baseline)", () => {
    writeFileSync(join(work, "config.json"), "name=MINE\n");
    gilAt(work, "add", "config.json");
    pushUpstream("config.json", "name=upstream-v2\n");

    const r = spawnSync("git", ["pull", "origin", "main"], { cwd: work, encoding: "utf8" });
    expect(r.stderr).toMatch(/would be overwritten by merge/);
  });

  it("gil pull is seamless when upstream changed a different file", () => {
    writeFileSync(join(work, "config.json"), "name=MINE\n");
    gilAt(work, "add", "config.json");
    pushUpstream("other.txt", "one\ntwo\n"); // upstream touches a NON-giled file

    const { code, out } = gilAt(work, "pull", "origin", "main");
    expect(code).toBe(0);
    expect(out).toMatch(/re-giled 1 file/);
    // upstream change landed
    expect(readFileSync(join(work, "other.txt"), "utf8")).toBe("one\ntwo\n");
    // local edit preserved and still hidden from git
    expect(readFileSync(join(work, "config.json"), "utf8")).toBe("name=MINE\n");
    expect(git2(work, "status", "--porcelain")).toBe("");
  });

  it("gil pull surfaces a conflict when upstream changed the giled file, leaving it un-giled", () => {
    writeFileSync(join(work, "config.json"), "name=MINE\n");
    gilAt(work, "add", "config.json");
    pushUpstream("config.json", "name=upstream-v2\n");

    const { code, out } = gilAt(work, "pull", "origin", "main");
    expect(code).toBe(1); // signals action needed
    expect(out).toMatch(/merge conflicts/i);
    // conflict markers present for the user to resolve
    expect(readFileSync(join(work, "config.json"), "utf8")).toMatch(/<<<<<<</);
    // it is NOT re-giled — git can see the conflict
    expect(git2(work, "status", "--porcelain")).toMatch(/config\.json/);
  });
});

describe("list", () => {
  it("reports both mechanisms", () => {
    writeFileSync(join(repo, "tracked.txt"), "v1");
    git("add", "tracked.txt");
    git("commit", "-qm", "c");
    writeFileSync(join(repo, "tracked.txt"), "v2");
    writeFileSync(join(repo, "untracked.local"), "x");

    gil("add", "tracked.txt");
    gil("add", "untracked.local");

    const out = gil("list");
    expect(out).toMatch(/untracked\.local/);
    expect(out).toMatch(/tracked\.txt/);
    expect(out).toMatch(/skip-worktree/);
  });
});
