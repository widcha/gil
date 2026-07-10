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
