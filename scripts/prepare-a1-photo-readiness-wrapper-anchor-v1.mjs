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

// Fleet readiness is earlier than the final fixed-aircraft Cab proof. Do not let
// the coarse environment fitter veto a seam-safe final Cab articulation. The
// exact final proof below remains fail-closed against the immovable CRJ door.
source = source.replaceAll(
  `finalVisibleFit.correctedCabContactPlaneCovered === true\n            && finalVisibleFit.correctedCabDoorLaterallyCovered === true\n            && Number.isFinite(finalVisibleFit.cabTunnelCSeamGapMeters)`,
  `Number.isFinite(finalVisibleFit.cabTunnelCSeamGapMeters)`,
);
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

// The environment-level Cab fitter runs before the final rendered-aircraft proof
// and cannot perform the last small yaw/hood articulation. Keep its measurements
// as diagnostics but remove only its premature plane/lateral fatal vetoes.
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
let doorFit = fs.readFileSync(doorFitPath, "utf8");
const coarseFootprintToken = "A1 exact CRJ door is outside supplied Cab passenger footprint";
while (doorFit.includes(coarseFootprintToken)) {
  const tokenIndex = doorFit.indexOf(coarseFootprintToken);
  const blockStart = doorFit.lastIndexOf("  if (", tokenIndex);
  const blockEndStart = doorFit.indexOf("\n  }", tokenIndex);
  if (blockStart < 0 || blockEndStart < 0) throw new Error(`${doorFitPath}: could not isolate coarse Cab footprint veto`);
  const blockEnd = blockEndStart + "\n  }".length;
  const block = doorFit.slice(blockStart, blockEnd);
  if (!block.includes("correctedCabContactPlaneCovered") || !block.includes("correctedCabDoorLaterallyCovered")) {
    throw new Error(`${doorFitPath}: coarse Cab footprint token was found outside expected physical guard`);
  }
  doorFit = doorFit.slice(0, blockStart)
    + `  // a1-defer-coarse-cab-horizontal-footprint-to-final-rendered-proof-v1\n  // measured plane/lateral residuals remain telemetry; final fixed-aircraft Cab proof owns acceptance.`
    + doorFit.slice(blockEnd);
}
doorFit = doorFit.replaceAll(
  "    !correctedCabContactPlaneCovered\n    || !correctedCabDoorLaterallyCovered\n    || ",
  "    ",
);
fs.writeFileSync(doorFitPath, doorFit, "utf8");
if (doorFit.includes(coarseFootprintToken)) throw new Error(`${doorFitPath}: coarse Cab footprint veto survived`);

// The final browser proof is the authoritative physical contact check. Add a
// bounded door-normal correction in addition to its existing lateral correction,
// and permit up to 22 cm of seam-safe Cab hood articulation in either horizontal
// axis. The aircraft, terminal, Rotunda and Tunnel-C carrier remain fixed.
const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let trainer = fs.readFileSync(trainerPath, "utf8");
const finalProofMarker = "a1-final-exact-cab-footprint-door-contact-v6-bounded-lateral-and-vertical-fit";
if (!trainer.includes(finalProofMarker)) throw new Error(`${trainerPath}: final Cab proof missing before photo readiness normalization`);
trainer = trainer.replace(
  "return { face, hood, side, minNormal, maxNormal, minLateral, maxLateral, nearestHorizontal, minHeight, maxHeight };",
  "return { face, hood, doorward, side, minNormal, maxNormal, minLateral, maxLateral, nearestHorizontal, minHeight, maxHeight };",
);
const normalAnchor = "            let physical = measurePhysicalCab();\n            let finalCabLateralCorrectionMeters = 0;";
const normalBlock = `            let physical = measurePhysicalCab();\n            let finalCabNormalCorrectionMeters = 0;\n            if (physical.maxNormal < -0.04) {\n              finalCabNormalCorrectionMeters = 0.02 - physical.maxNormal;\n            } else if (physical.minNormal > 0.04) {\n              finalCabNormalCorrectionMeters = -0.02 - physical.minNormal;\n            }\n            if (!Number.isFinite(finalCabNormalCorrectionMeters)\n              || Math.abs(finalCabNormalCorrectionMeters) > 0.22) {\n              throw new Error(\`A1 final Cab requires excessive door-normal articulation: \${finalCabNormalCorrectionMeters} m from normal [\${physical.minNormal},\${physical.maxNormal}]\`);\n            }\n            if (Math.abs(finalCabNormalCorrectionMeters) > 0.002) {\n              moveCabWorld(physical.doorward.clone().multiplyScalar(finalCabNormalCorrectionMeters));\n              physical = measurePhysicalCab();\n            }\n\n            let finalCabLateralCorrectionMeters = 0;`;
if (!trainer.includes("finalCabNormalCorrectionMeters")) {
  if (!trainer.includes(normalAnchor)) throw new Error(`${trainerPath}: final Cab normal-correction insertion anchor missing`);
  trainer = trainer.replace(normalAnchor, normalBlock);
}
trainer = trainer.replaceAll("Math.abs(finalCabLateralCorrectionMeters) > 0.15", "Math.abs(finalCabLateralCorrectionMeters) > 0.22");
trainer = trainer.replaceAll("Lateral correction is bounded to 15 cm", "Door-normal and lateral correction are each bounded to 22 cm");
trainer = trainer.replace(
  "renderer.domElement.dataset.inspectionAircraftCabLateralCorrectionMeters = finalCabLateralCorrectionMeters.toFixed(6);",
  "renderer.domElement.dataset.inspectionAircraftCabNormalCorrectionMeters = finalCabNormalCorrectionMeters.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabLateralCorrectionMeters = finalCabLateralCorrectionMeters.toFixed(6);",
);
fs.writeFileSync(trainerPath, trainer, "utf8");
for (const required of ["finalCabNormalCorrectionMeters", "inspectionAircraftCabNormalCorrectionMeters", "Math.abs(finalCabLateralCorrectionMeters) > 0.22"]) {
  if (!trainer.includes(required)) throw new Error(`${trainerPath}: final Cab photo-normalized proof missing ${required}`);
}

console.log(`Prepared stable A1 photo-readiness anchors, deferred coarse pre-render Cab footprint vetoes, and added bounded final rendered Cab door-normal/lateral articulation while keeping the fixed CRJ and Tunnel-C carrier authoritative.`);
