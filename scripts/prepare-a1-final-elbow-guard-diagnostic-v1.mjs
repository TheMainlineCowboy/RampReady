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

if (matches.length > 0) {
  const detail = matches
    .map(({ entryPath, context }, matchIndex) => `MATCH_${matchIndex + 1}_FILE=${entryPath}\n${context}`)
    .join("\n---NEXT_MATCH---\n");
  throw new Error(`SURVIVING_A1_DECODED_KPHX_ELBOW_GUARD_CONTEXT_BEGIN\n${detail}\nSURVIVING_A1_DECODED_KPHX_ELBOW_GUARD_CONTEXT_END`);
}

console.log("No surviving generated decoded-KPHX terminal-side elbow guard was found anywhere in the final generated src tree.");

// The old rendered-door module is bundled only after all A1 preparers have
// finished. Install a temporary Vite wrapper now so that module validates the
// Aug. 15 photo-authoritative long fixed dogleg instead of the retired compact
// 2.9-5.8 m wall / 1.2-3.6 m vestibule assumptions. The wrapper restores the
// tracked rendered-door source immediately after Vite finishes.
await import(`./prepare-a1-photo-dogleg-rendered-door-build-hook-v1.mjs?final-guard=${Date.now()}`);
// The photo bundle hook above creates the true final pre-Vite camera sequence.
// Add the two aircraft-side reference subviews there, after final Tunnel-C stair
// and bogie normalization, so perspective overlap can be judged without changing
// terminal, aircraft or exact supplied jetway geometry.
await import(`./prepare-a1-aircraft-side-evidence-build-hook-v1.mjs?final-aircraft-side-hook=${Date.now()}`);
