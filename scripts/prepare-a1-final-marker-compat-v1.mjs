import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const sourcePlacedPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const SOURCE_OWNER = "a1-decoded-kphx-bgl-rotunda-and-heading-own-physical-jetway-v1";
let source = fs.readFileSync(trainerPath, "utf8");

const currentMarkers = [
  "final-a1-acceptance-authority-after-all-preparers-v4-source-static-integrity",
  "final-a1-acceptance-authority-after-all-preparers-v3-three-tire-contact",
  "final-a1-acceptance-authority-after-all-preparers-v2",
];
const workflowMarker = "final-a1-acceptance-authority-after-all-preparers-v1";
for (const currentMarker of currentMarkers) {
  source = source.replaceAll(currentMarker, workflowMarker);
}

for (const token of [
  workflowMarker,
  "inspectionAircraftLandingGearContactPatchCount",
  "inspectionAircraftNoseTireContact",
  "inspectionAircraftLeftMainTireContact",
  "inspectionAircraftRightMainTireContact",
  "terminal4A1JetwayWallDistance",
  "terminal4A1ConnectionAuthority",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  "terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed",
  "terminal4UploadedJetwayA1NoGeneratedGlassCorridor",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: final compatible A1 marker is missing acceptance evidence ${token}`);
  }
}
for (const currentMarker of currentMarkers) {
  if (source.includes(currentMarker)) {
    throw new Error(`${trainerPath}: superseded final acceptance marker remains after workflow compatibility migration: ${currentMarker}`);
  }
}
fs.writeFileSync(trainerPath, source, "utf8");

// Marker compatibility must never own geometry. Normalize browser readiness to
// the same broad physical envelope used by the airport-owned A1 source pass and
// delete every historical 2.40 m / compact-photo condition that can survive a
// legacy preparer. The actual wall point, Rotunda pose and bridge yaw remain
// independently measured and verified by the generated runtime.
let readiness = fs.readFileSync(readinessPath, "utf8");
const finalWallGuard = "a1TerminalWallDistance > 0.5 && a1TerminalWallDistance < 44";
const finalVisibleLegGuard = "connectorVisibleLength > 0.15 && connectorVisibleLength < 44";
readiness = readiness
  .replace(/a1TerminalWallDistance\s*(?:>|>=)\s*[0-9.]+\s*&&\s*a1TerminalWallDistance\s*(?:<|<=)\s*[0-9.]+/g, finalWallGuard)
  .replace(/connectorVisibleLength\s*(?:>|>=)\s*[0-9.]+\s*&&\s*connectorVisibleLength\s*(?:<|<=)\s*[0-9.]+/g, finalVisibleLegGuard)
  .replaceAll("Math.abs(connectorVisibleLength - 2.4) > 0.05", `!(${finalVisibleLegGuard})`)
  .replaceAll("Math.abs(connectorVisibleLength - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05", `!(${finalVisibleLegGuard})`);

if (!readiness.includes(finalWallGuard) || !readiness.includes(finalVisibleLegGuard)) {
  const mismatchAnchor = `          if (\n            count !== EXPECTED_GATE_COUNT`;
  if (!readiness.includes(mismatchAnchor)) {
    throw new Error(`${readinessPath}: final exact-fleet readiness mismatch block is missing before source-wall seeding`);
  }
  const seededConditions = [
    !readiness.includes(finalWallGuard) ? `!(${finalWallGuard})` : null,
    !readiness.includes(finalVisibleLegGuard) ? `!(${finalVisibleLegGuard})` : null,
  ].filter(Boolean);
  readiness = readiness.replace(
    mismatchAnchor,
    `          if (\n            ${seededConditions.join("\n            || ")}\n            || count !== EXPECTED_GATE_COUNT`,
  );
}
for (const guard of [finalWallGuard, finalVisibleLegGuard]) {
  if (!readiness.includes(guard)) {
    throw new Error(`${readinessPath}: failed to preserve final physical A1 readiness guard ${guard}`);
  }
}
for (const forbidden of [
  "a1TerminalWallDistance > 2.9 && a1TerminalWallDistance < 5.8",
  "a1TerminalWallDistance >= 2.9 && a1TerminalWallDistance <= 5.8",
  "connectorVisibleLength > 1.2 && connectorVisibleLength < 3.6",
  "connectorVisibleLength >= 1.2 && connectorVisibleLength <= 3.6",
  "Math.abs(connectorVisibleLength - 2.4) > 0.05",
]) {
  if (readiness.includes(forbidden)) {
    throw new Error(`${readinessPath}: compact A1 readiness survived final marker compatibility: ${forbidden}`);
  }
}
fs.writeFileSync(readinessPath, readiness, "utf8");

// The preceding source-ownership pass is the final geometry authority. Do NOT
// call prepare-a1-real-terminal-final-geometry-v1 here: that historical helper
// rewrites the valid 0.5-44 m source wall envelope back to 2.9-5.8 m, rewrites
// the visible leg to 1.2-3.6 m, and therefore rejects the real 19.965 m A1 wall
// span after the correct airport pose has already been restored.
let elbow = fs.readFileSync(elbowPath, "utf8");
const sourcePlaced = fs.readFileSync(sourcePlacedPath, "utf8");
for (const required of [
  SOURCE_OWNER,
  "const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)",
  "anchor.rotation.y = Number(placement.yaw)",
  "terminalWallDistance > 0.5 && terminalWallDistance < 44",
  "uploadedJetwayA1MeasuredTerminalWallX",
]) {
  if (!elbow.includes(required)) {
    throw new Error(`${elbowPath}: airport-owned A1 geometry was lost before final marker compatibility: ${required}`);
  }
}
for (const forbidden of [
  "terminalWallDistance >= 2.9 && terminalWallDistance <= 5.8",
  "terminalWallDistance > 2.9 && terminalWallDistance < 5.8",
  "anchor.rotation.y += yawDelta;",
  "A1 supplied bridge does not point at the source A1 door target",
]) {
  if (elbow.includes(forbidden)) {
    throw new Error(`${elbowPath}: compact/aircraft-owned A1 geometry survived final marker compatibility: ${forbidden}`);
  }
}
if (sourcePlaced.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${sourcePlacedPath}: obsolete elevated T4_WALK A1 portal survived final marker compatibility`);
}
if (!sourcePlaced.includes("structural-A1-terminal-building-")) {
  throw new Error(`${sourcePlacedPath}: structural Terminal 4 A1 wall authority is missing`);
}

// Keep only the hidden facade penetration from the old compatibility layer. It
// closes the generated terminal-side shell behind the real wall and does not
// move the supplied Rotunda, alter the visible source-measured span, re-aim the
// bridge, or touch any authored GLB child transform.
const compactOverlap = "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;";
const sealedOverlap = "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.70;";
if (elbow.includes(compactOverlap)) {
  elbow = elbow.replace(compactOverlap, sealedOverlap);
} else if (!elbow.includes(sealedOverlap)) {
  throw new Error(`${elbowPath}: final A1 terminal-wall overlap anchor is missing`);
}
if (!elbow.includes("const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;")) {
  throw new Error(`${elbowPath}: Rotunda-side overlap changed while sealing the terminal wall`);
}
if (!elbow.includes(SOURCE_OWNER)) {
  throw new Error(`${elbowPath}: source-owned A1 authority disappeared while sealing the wall`);
}
fs.writeFileSync(elbowPath, elbow, "utf8");

console.log("Published the established exact-head acceptance marker without invoking the retired compact-photo A1 finalizer. Preserved decoded KPHX A1 Rotunda x/z/yaw, the measured real Terminal 4 wall span, the supplied jetway hierarchy and whole-fleet grounding; only the hidden terminal-side shell penetrates 0.70 m behind the real facade, and T4_WALK remains forbidden.");