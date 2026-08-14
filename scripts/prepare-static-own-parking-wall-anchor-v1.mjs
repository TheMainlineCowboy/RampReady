import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "static-own-parking-terminal-wall-anchor-v1";
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  const oldBlock = `    const resolvedTerminalConnection = jetway.g === "A1"\n      ? terminalConnection\n      : (sourceHeadingTerminalConnection || terminalConnection);`;
  const newBlock = `    // ${marker}\n    // For static bridges, the actual KPHX stand geometry owns both sides of the\n    // rigid replacement: the aircraft-side arm points at its own authored\n    // parking target, and the terminal-side wall search follows the exact\n    // opposite ray from that same stand. The decoded AIR_Jetway01 BGL heading\n    // remains useful provenance and a fallback only when the own-parking wall\n    // search has no structural hit. Preferring the BGL-heading wall at concourse\n    // corners can snap neighboring Rotundas onto the same facade region.\n    const resolvedTerminalConnection = jetway.g === "A1"\n      ? terminalConnection\n      : (terminalConnection || sourceHeadingTerminalConnection);`;
  if (!source.includes(oldBlock)) {
    throw new Error(`${runtimePath}: static source-heading wall-priority block is missing`);
  }
  source = source.replace(oldBlock, newBlock);
}

for (const required of [
  marker,
  ': (terminalConnection || sourceHeadingTerminalConnection);',
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: own-parking static wall-anchor contract is missing ${required}`);
  }
}
if (source.includes(': (sourceHeadingTerminalConnection || terminalConnection);')) {
  throw new Error(`${runtimePath}: stale BGL-heading static wall priority survived`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Anchored static Terminal 4 jetways to the structural wall directly opposite each gate's own KPHX parking centerline; decoded BGL-heading wall search is fallback/provenance only.");
