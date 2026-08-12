import fs from "node:fs";
import path from "node:path";

const sourceRoot = "src";
const needle = "A1 decoded KPHX bridge lost the required terminal-side elbow";
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const matches = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath);
      continue;
    }
    if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) continue;
    const source = fs.readFileSync(entryPath, "utf8");
    let index = source.indexOf(needle);
    while (index >= 0) {
      const start = Math.max(0, index - 1800);
      const end = Math.min(source.length, index + needle.length + 1800);
      matches.push({ entryPath, context: source.slice(start, end) });
      index = source.indexOf(needle, index + needle.length);
    }
  }
}

walk(sourceRoot);

if (matches.length === 0) {
  console.log("No surviving generated decoded-KPHX terminal-side elbow guard was found anywhere in the final generated src tree.");
  process.exit(0);
}

const detail = matches
  .map(({ entryPath, context }, matchIndex) => `MATCH_${matchIndex + 1}_FILE=${entryPath}\n${context}`)
  .join("\n---NEXT_MATCH---\n");
throw new Error(`SURVIVING_A1_DECODED_KPHX_ELBOW_GUARD_CONTEXT_BEGIN\n${detail}\nSURVIVING_A1_DECODED_KPHX_ELBOW_GUARD_CONTEXT_END`);
