import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const BEGIN = "# >>> gil managed (do not edit below) >>>";
const END = "# <<< gil managed <<<";
function read(file) {
    if (!existsSync(file))
        return [];
    const text = readFileSync(file, "utf8");
    if (text === "")
        return [];
    const lines = text.split("\n");
    // A trailing newline produces a final empty element; drop it so we control spacing.
    if (lines.length > 0 && lines[lines.length - 1] === "")
        lines.pop();
    return lines;
}
function parse(file) {
    const lines = read(file);
    const begin = lines.indexOf(BEGIN);
    const end = lines.indexOf(END);
    if (begin === -1 || end === -1 || end < begin) {
        return { before: lines, entries: [], after: [], hadBlock: false };
    }
    return {
        before: lines.slice(0, begin),
        entries: lines.slice(begin + 1, end).filter((l) => l.trim() !== ""),
        after: lines.slice(end + 1),
        hadBlock: true,
    };
}
/** Entries currently in the managed block of `file` (empty if none / no file). */
export function listEntries(file) {
    return parse(file).entries;
}
function write(file, parsed) {
    const { before, entries, after } = parsed;
    const out = [];
    const trimTrailingBlank = (arr) => {
        const copy = [...arr];
        while (copy.length && copy[copy.length - 1].trim() === "")
            copy.pop();
        return copy;
    };
    const head = trimTrailingBlank(before);
    out.push(...head);
    if (entries.length > 0) {
        if (head.length > 0)
            out.push("");
        out.push(BEGIN, ...entries, END);
        const tail = after.filter((l) => l.trim() !== "" || false);
        if (tail.length > 0) {
            out.push("");
            out.push(...after.slice(after.findIndex((l) => l.trim() !== "")));
        }
    }
    else {
        // No entries left: drop the block entirely, preserving surrounding content.
        const rest = [...head];
        const tailStart = after.findIndex((l) => l.trim() !== "");
        if (tailStart !== -1) {
            if (rest.length > 0)
                rest.push("");
            rest.push(...after.slice(tailStart));
        }
        out.length = 0;
        out.push(...rest);
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, out.length ? out.join("\n") + "\n" : "");
}
/** Add `entry` to the managed block if absent. Returns true if it was newly added. */
export function addEntry(file, entry) {
    const parsed = parse(file);
    if (parsed.entries.includes(entry))
        return false;
    parsed.entries.push(entry);
    write(file, parsed);
    return true;
}
/** Remove `entry` from the managed block if present. Returns true if it was removed. */
export function removeEntry(file, entry) {
    const parsed = parse(file);
    const idx = parsed.entries.indexOf(entry);
    if (idx === -1)
        return false;
    parsed.entries.splice(idx, 1);
    write(file, parsed);
    return true;
}
//# sourceMappingURL=managedBlock.js.map