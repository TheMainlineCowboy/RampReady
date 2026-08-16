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
// generated module currently contains more than one equivalent A1 readiness
// branch, so normalize every final guard line that owns one of these three A1
// variables instead of assuming a single textual occurrence. This remains a
// validator-only preparation: no runtime geometry, airport/aircraft placement,
// or Airport_Jetway.glb content is changed. The immediately-following bundle
// wrapper replaces every normalized guard with the Aug. 15 dogleg + two-column
// photo conditions.
for (const { variable, expression } of compactGuards) {
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith("||") && trimmed.includes(variable)) matches.push(index);
  }

  if (matches.length < 1) {
    throw new Error(`${readinessPath}: expected at least one final readiness guard for ${variable}, found 0`);
  }

  for (const index of matches) {
    const indentation = lines[index].match(/^\s*/)?.[0] || "            ";
    lines[index] = `${indentation}|| ${expression}`;
  }
}

source = lines.join("\n");
fs.writeFileSync(readinessPath, source, "utf8");

for (const { variable, expression } of compactGuards) {
  const expected = `|| ${expression}`;
  const count = source.split(expected).length - 1;
  if (count < 1) {
    throw new Error(`${readinessPath}: photo readiness wrapper anchor was not installed for ${variable}`);
  }
}

console.log("Prepared stable A1 photo-readiness wrapper anchors across every generated A1 readiness branch for zero-extension, wall-distance and visible-corridor guards; geometry remains unchanged.");
