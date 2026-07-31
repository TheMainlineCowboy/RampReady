import fs from "node:fs";

const path = "scripts/build-production.mjs";
let source = fs.readFileSync(path, "utf8");
const authority = "committed-source-restoration-for-exact-B15-v16";

if (!source.includes(authority)) {
  const importAnchor = 'import { spawn } from "node:child_process";';
  if (!source.includes(importAnchor)) throw new Error(`${path}: missing child-process import anchor`);
  source = source.replace(importAnchor, 'import { execFileSync, spawn } from "node:child_process";');

  const restorationAnchor = "const originalSourcePlacedJetwaySource = restoreA1TerminalConnectorV11(preparedSourcePlacedJetwaySource);";
  const restorationReplacement = `// ${authority}
// The exact B15 pass intentionally expands beyond the legacy 48 m connector
// contract. Build the prepared source, then restore the committed source file
// directly instead of trying to reverse every visual preparation by tokens.
const originalSourcePlacedJetwaySource = preparedSourcePlacedJetwaySource.includes("exact-BGATE3-B15-regional-wall-plane-v16")
  ? execFileSync(
    "git",
    ["show", "HEAD:src/environment/sourcePlacedTerminal4Jetways.js"],
    { encoding: "utf8" },
  )
  : restoreA1TerminalConnectorV11(preparedSourcePlacedJetwaySource);`;
  if (!source.includes(restorationAnchor)) throw new Error(`${path}: missing source-placed restoration anchor`);
  source = source.replace(restorationAnchor, restorationReplacement);
}

for (const token of [
  authority,
  'import { execFileSync, spawn } from "node:child_process";',
  'preparedSourcePlacedJetwaySource.includes("exact-BGATE3-B15-regional-wall-plane-v16")',
  '"HEAD:src/environment/sourcePlacedTerminal4Jetways.js"',
]) {
  if (!source.includes(token)) throw new Error(`${path}: B15 production restoration is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared production restoration for exact B15 connectors: Vite builds the expanded runtime, then the committed jetway source is restored byte-for-byte.");
