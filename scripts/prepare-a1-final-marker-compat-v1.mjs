import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
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

// Late compatibility preparers can remove the historical terminal-authority
// comparison that an older finalizer used as an insertion point. Seed the real
// physical guards beside conditions that survive every readiness migration:
// the normalized terminal-direction check and the connector-rib check. The
// real-wall finalizer then normalizes/revalidates these exact guards and remains
// the sole final geometry owner.
let readiness = fs.readFileSync(readinessPath, "utf8");
const finalWallGuard = "a1TerminalWallDistance > 0.5 && a1TerminalWallDistance < 44";
const finalVisibleLegGuard = "connectorVisibleLength > 0.15 && connectorVisibleLength < 44";
if (!readiness.includes(finalWallGuard)) {
  const stableWallAnchor = "            || Math.abs(terminalDirectionMagnitude - 1) > 0.01";
  if (!readiness.includes(stableWallAnchor)) {
    throw new Error(`${readinessPath}: stable terminal-direction readiness anchor is missing before final real-wall seeding`);
  }
  readiness = readiness.replace(
    stableWallAnchor,
    `            || !(${finalWallGuard})\n${stableWallAnchor}`,
  );
}
if (!readiness.includes(finalVisibleLegGuard)) {
  const stableConnectorPattern = /            \|\| connectorRibCount < \d+/;
  const match = readiness.match(stableConnectorPattern);
  if (!match) {
    throw new Error(`${readinessPath}: stable connector-rib readiness anchor is missing before final fixed-leg seeding`);
  }
  readiness = readiness.replace(
    stableConnectorPattern,
    `            || !(${finalVisibleLegGuard})\n${match[0]}`,
  );
}
fs.writeFileSync(readinessPath, readiness, "utf8");

// Marker compatibility is not a geometry authority. Reassert the single final
// A1 geometry owner after every legacy preparer; it normalizes the seeded real
// wall/fixed-leg guards and writes the final runtime immediately before bundle.
await import(`./prepare-a1-real-terminal-final-geometry-v1.mjs?final-real-wall=${Date.now()}`);

console.log("Published the established exact-head acceptance marker, seeded the final real-wall/fixed-leg guards at stable physical readiness anchors, then delegated all A1 geometry/readiness ownership to the source-measured real-Terminal-4-wall finalizer.");
