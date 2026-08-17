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

const staleCompactPreFitGuard = `          if (!(a1TerminalWallDistance > 2.9 && a1TerminalWallDistance < 5.8)
            || !(connectorVisibleLength > 1.2 && connectorVisibleLength < 3.6)) {
            throw new Error(\`A1 compact-stage wall/leg physical guard failed before final visible fit: wall=\${a1TerminalWallDistance} leg=\${connectorVisibleLength}\`);
          }`;
const photoAuthoritativePreFitGuard = `          if (!(a1TerminalWallDistance > 18 && a1TerminalWallDistance < 30)
            || !(connectorVisibleLength > 6 && connectorVisibleLength < 48)) {
            throw new Error(\`A1 Aug. 15 long fixed-route physical guard failed before final visible fit: wall=\${a1TerminalWallDistance} leg=\${connectorVisibleLength}\`);
          }`;

let source = fs.readFileSync(readinessPath, "utf8");

// The historical compact-wall compatibility pass can insert a standalone
// pre-fit guard immediately before the live Cab/door solver. By the time this
// final photo-readiness pass runs, A1 has already been restored to the Aug. 15
// long fixed corridor/dogleg and remote Rotunda. Letting the old 2.9-5.8 m /
// 1.2-3.6 m gate survive here makes the correct final route fail before the
// physical door fit can execute. Replace only that exact legacy guard with the
// bounded photo-authoritative route envelope; A3+ and supplied GLB geometry are
// untouched and the later Vite wrapper still owns final fail-closed acceptance.
const stalePreFitCount = source.split(staleCompactPreFitGuard).length - 1;
if (stalePreFitCount > 1) {
  throw new Error(`${readinessPath}: found ${stalePreFitCount} stale compact A1 pre-fit guards; expected at most one`);
}
if (stalePreFitCount === 1) {
  source = source.replace(staleCompactPreFitGuard, photoAuthoritativePreFitGuard);
}
if (source.includes("A1 compact-stage wall/leg physical guard failed before final visible fit")) {
  throw new Error(`${readinessPath}: stale compact A1 pre-fit runtime guard survived photo normalization`);
}

let lines = source.split("\n");

function replaceNegatedGuardPreservingSuffix(line, replacementExpression) {
  const negationStart = line.indexOf("!(");
  if (negationStart < 0) return null;

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

function normalizeGuardLine(line, variable, replacementExpression) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("||") || !trimmed.includes(variable)) return null;

  const negated = replaceNegatedGuardPreservingSuffix(line, replacementExpression);
  if (negated) return negated;

  // Later physical-door/readiness passes may already express the A1 attached
  // extension as finite + near-zero instead of a parenthesized compact-range
  // predicate. This is a valid photo-authoritative guard shape. Convert only
  // that complete guard line into the stable temporary wrapper anchor; the Vite
  // wrapper immediately replaces it with the final photoGeometryActive ternary.
  // Do not treat arbitrary telemetry lines mentioning the variable as guards.
  if (
    variable === "a1AttachedExtension"
    && trimmed.startsWith("|| !Number.isFinite(a1AttachedExtension)")
    && trimmed.includes("Math.abs(a1AttachedExtension)")
  ) {
    const indentation = line.match(/^\s*/)?.[0] || "            ";
    return `${indentation}|| ${replacementExpression}`;
  }

  return null;
}

// Several late readiness preparers correctly rewrite A1 away from the retired
// compact sleeve contract before the final photo-aware Vite wrapper runs. The
// generated module currently contains more than one equivalent A1 readiness
// branch and more than one grammar shape, so normalize only actual guard lines
// for these three A1 variables instead of every line that happens to mention
// them. This remains validator-only preparation: no runtime geometry,
// airport/aircraft placement, or Airport_Jetway.glb content is changed.
for (const { variable, expression } of compactGuards) {
  let replacementCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeGuardLine(lines[index], variable, expression);
    if (normalized == null) continue;
    lines[index] = normalized;
    replacementCount += 1;
  }

  if (replacementCount < 1) {
    throw new Error(`${readinessPath}: expected at least one normalizable final readiness guard for ${variable}, found 0`);
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

if (stalePreFitCount === 1 && !source.includes("A1 Aug. 15 long fixed-route physical guard failed before final visible fit")) {
  throw new Error(`${readinessPath}: photo-authoritative A1 pre-fit runtime guard was not retained after normalization`);
}

// Catch the exact malformed shape that previously escaped the normalizer:
// a final `||` parenthesized readiness guard followed immediately by `throw`
// without an outer condition close/open block.
if (/\|\|\s*!\([^\n]+\)\s*\n\s*throw new Error/.test(source)) {
  throw new Error(`${readinessPath}: normalized readiness guard lost its outer if-condition closing syntax`);
}

console.log(`Prepared stable A1 photo-readiness wrapper anchors across every generated A1 readiness branch, replaced ${stalePreFitCount} stale compact pre-fit runtime guard(s) with the bounded Aug. 15 long-route envelope, and preserved outer if-condition syntax; geometry remains unchanged.`);
