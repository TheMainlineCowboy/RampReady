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

function replaceNegatedGuardPreservingSuffix(line, replacementExpression) {
  const negationStart = line.indexOf("!(");
  if (negationStart < 0) {
    throw new Error(`${readinessPath}: readiness guard has no negated-expression anchor: ${line.trim()}`);
  }

  let depth = 0;
  let expressionEnd = -1;
  for (let index = negationStart + 1; index < line.length; index += 1) {
    const character = line[index];
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        expressionEnd = index;
        break;
      }
    }
  }

  if (expressionEnd < 0) {
    throw new Error(`${readinessPath}: readiness guard has an unterminated negated expression: ${line.trim()}`);
  }

  // Keep everything after the guard itself. This matters when the final guard is
  // also the last term in an if-condition, where the same generated line owns
  // the outer `) {`. The old whole-line replacement dropped that suffix and
  // produced invalid JavaScript immediately before Vite.
  return `${line.slice(0, negationStart)}${replacementExpression}${line.slice(expressionEnd + 1)}`;
}

// Several late readiness preparers correctly rewrite A1 away from the retired
// compact sleeve contract before the final photo-aware Vite wrapper runs. The
// generated module currently contains more than one equivalent A1 readiness
// branch, so normalize every final guard line that owns one of these three A1
// variables instead of assuming a single textual occurrence. This remains a
// validator-only preparation: no runtime geometry, airport/aircraft placement,
// or Airport_Jetway.glb content is changed. Preserve any outer if-condition
// closing syntax on the same line; the immediately-following bundle wrapper
// replaces every normalized guard with the Aug. 15 dogleg + two-column photo
// conditions.
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
    lines[index] = replaceNegatedGuardPreservingSuffix(lines[index], expression);
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

// Catch the exact malformed shape that previously escaped the normalizer:
// a final `||` readiness guard followed immediately by `throw` without an
// outer condition close/open block.
if (/\|\|\s*!\([^\n]+\)\s*\n\s*throw new Error/.test(source)) {
  throw new Error(`${readinessPath}: normalized readiness guard lost its outer if-condition closing syntax`);
}

console.log("Prepared stable A1 photo-readiness wrapper anchors across every generated A1 readiness branch while preserving each guard line's outer if-condition suffix; geometry remains unchanged.");
