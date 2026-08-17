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

const STALE_PREFIT_TOKEN = "A1 compact-stage wall/leg physical guard failed before final visible fit";
const photoAuthoritativePreFitGuard = `          if (!(a1TerminalWallDistance > 18 && a1TerminalWallDistance < 30)
            || !(connectorVisibleLength > 6 && connectorVisibleLength < 48)) {
            throw new Error(\`A1 Aug. 15 long fixed-route physical guard failed before final visible fit: wall=\${a1TerminalWallDistance} leg=\${connectorVisibleLength}\`);
          }`;

let source = fs.readFileSync(readinessPath, "utf8");

// The historical compact-wall compatibility pass can insert a standalone
// pre-fit guard immediately before the live Cab/door solver. Generated bounds
// and whitespace can change across earlier preparers, so do not depend on one
// literal spelling of that block. The error token is unique to this obsolete
// runtime veto. Locate its enclosing if-block, require both physical A1 metrics
// to be present, and replace only that block with the bounded Aug. 15 long-route
// envelope. A3+, Terminal 4, the aircraft and supplied GLB geometry are untouched.
let stalePreFitCount = 0;
while (source.includes(STALE_PREFIT_TOKEN)) {
  const markerIndex = source.indexOf(STALE_PREFIT_TOKEN);
  const blockStart = source.lastIndexOf("          if (", markerIndex);
  const blockEndStart = source.indexOf("\n          }", markerIndex);
  if (blockStart < 0 || blockEndStart < 0) {
    throw new Error(`${readinessPath}: could not isolate stale compact A1 pre-fit runtime guard around its unique error token`);
  }
  const blockEnd = blockEndStart + "\n          }".length;
  const block = source.slice(blockStart, blockEnd);
  if (!block.includes("a1TerminalWallDistance") || !block.includes("connectorVisibleLength")) {
    throw new Error(`${readinessPath}: stale compact A1 pre-fit token was found outside the expected wall/visible-leg guard`);
  }
  source = `${source.slice(0, blockStart)}${photoAuthoritativePreFitGuard}${source.slice(blockEnd)}`;
  stalePreFitCount += 1;
  if (stalePreFitCount > 4) {
    throw new Error(`${readinessPath}: excessive stale compact A1 pre-fit guards (${stalePreFitCount})`);
  }
}
if (source.includes(STALE_PREFIT_TOKEN)) {
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

  return `${line.slice(0, negationStart)}${replacementExpression}${line.slice(expressionEnd + 1)}`;
}

function normalizeGuardLine(line, variable, replacementExpression) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("||") || !trimmed.includes(variable)) return null;

  const negated = replaceNegatedGuardPreservingSuffix(line, replacementExpression);
  if (negated) return negated;

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

if (stalePreFitCount > 0 && !source.includes("A1 Aug. 15 long fixed-route physical guard failed before final visible fit")) {
  throw new Error(`${readinessPath}: photo-authoritative A1 pre-fit runtime guard was not retained after normalization`);
}

if (/\|\|\s*!\([^\n]+\)\s*\n\s*throw new Error/.test(source)) {
  throw new Error(`${readinessPath}: normalized readiness guard lost its outer if-condition closing syntax`);
}

console.log(`Prepared stable A1 photo-readiness wrapper anchors across every generated A1 readiness branch, replaced ${stalePreFitCount} stale compact pre-fit runtime guard(s) with the bounded Aug. 15 long-route envelope, and preserved outer if-condition syntax; geometry remains unchanged.`);
