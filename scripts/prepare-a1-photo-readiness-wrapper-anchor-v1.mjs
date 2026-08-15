import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const compactGuards = Object.freeze([
  {
    variable: "a1AttachedExtension",
    expression: "!(a1AttachedExtension > 3 && a1AttachedExtension < 7)",
  },
  {
    variable: "a1TerminalWallDistance",
    expression: "!(a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12)",
  },
  {
    variable: "connectorVisibleLength",
    expression: "!(connectorVisibleLength > 0.25 && connectorVisibleLength < 12)",
  },
]);

let source = fs.readFileSync(readinessPath, "utf8");
let lines = source.split("\n");

// Several late readiness preparers correctly rewrite A1 away from the retired
// compact sleeve contract before the final photo-aware Vite wrapper runs. The
// wrapper deliberately performs one atomic A1-only replacement, so normalize
// only the three validator lines it owns back to stable textual anchors here.
// This does not change runtime geometry, the terminal, aircraft placement, or
// Airport_Jetway.glb; the immediately-following bundle wrapper replaces these
// temporary anchors with the Aug. 15 dogleg + two-column photo conditions.
for (const { variable, expression } of compactGuards) {
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith("||") && trimmed.includes(variable)) matches.push(index);
  }

  if (matches.length !== 1) {
    const contexts = matches.map((index) => `${index + 1}:${lines[index]}`).join("\n");
    throw new Error(`${readinessPath}: expected exactly one final readiness guard for ${variable}, found ${matches.length}${contexts ? `\n${contexts}` : ""}`);
  }

  const index = matches[0];
  const indentation = lines[index].match(/^\s*/)?.[0] || "            ";
  lines[index] = `${indentation}|| ${expression}`;
}

source = lines.join("\n");
fs.writeFileSync(readinessPath, source, "utf8");

for (const { variable, expression } of compactGuards) {
  const expected = `|| ${expression}`;
  if (!source.includes(expected)) {
    throw new Error(`${readinessPath}: photo readiness wrapper anchor was not installed for ${variable}`);
  }
}

console.log("Prepared stable A1 photo-readiness wrapper anchors for zero-extension, wall-distance and visible-corridor guards; geometry remains unchanged.");
