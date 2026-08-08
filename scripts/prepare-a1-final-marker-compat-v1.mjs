import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
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

// Late compatibility preparers remove/reformat several old A1-specific
// readiness conditions. The one invariant every final readiness version keeps
// is the top-level exact-fleet mismatch block. Seed the physical real-wall and
// source-measured fixed-leg guards there, ahead of the gate-count check, so no
// legacy authority/compactness rewrite can erase the final physical criteria.
let readiness = fs.readFileSync(readinessPath, "utf8");
const finalWallGuard = "a1TerminalWallDistance > 0.5 && a1TerminalWallDistance < 44";
const finalVisibleLegGuard = "connectorVisibleLength > 0.15 && connectorVisibleLength < 44";
if (!readiness.includes(finalWallGuard) || !readiness.includes(finalVisibleLegGuard)) {
  const mismatchAnchor = `          if (\n            count !== EXPECTED_GATE_COUNT`;
  if (!readiness.includes(mismatchAnchor)) {
    throw new Error(`${readinessPath}: final exact-fleet readiness mismatch block is missing before real-wall seeding`);
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
    throw new Error(`${readinessPath}: failed to seed final physical A1 readiness guard ${guard}`);
  }
}
fs.writeFileSync(readinessPath, readiness, "utf8");

// Marker compatibility is not a geometry authority. Reassert the single final
// A1 geometry owner after every legacy preparer; it normalizes/revalidates the
// seeded physical guards and writes the final runtime immediately before bundle.
await import(`./prepare-a1-real-terminal-final-geometry-v1.mjs?final-real-wall=${Date.now()}`);

// The exact-head render proved that the 0.18 m mathematical wall overlap can
// terminate in front of the visible facade surface even though the structural
// ray hit is valid. Seal only the generated terminal-side shell farther behind
// the real facade, using the same 0.70 m hidden penetration already used by the
// static Terminal 4 wall registrations. This does not change the visible
// wall-to-Rotunda leg, the supplied Rotunda, any authored child transform, or
// the aircraft-side bridge axis.
let elbow = fs.readFileSync(elbowPath, "utf8");
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
fs.writeFileSync(elbowPath, elbow, "utf8");

console.log("Published the established exact-head acceptance marker, delegated geometry to the source-measured real-Terminal-4-wall finalizer, then sealed only the hidden A1 vestibule end 0.70 m into the rendered facade while preserving the visible leg, supplied Rotunda, authored hierarchy, and grounded bogie.");
