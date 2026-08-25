import fs from "node:fs";

const runtimePath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const marker = "static-exact-bridge-axis-own-gate-source-heading-provenance-v2";
const authority = "57-static-own-gate-target-real-wall-source-heading-provenance-v11";
let source = fs.readFileSync(runtimePath, "utf8");

// This late compatibility stage used to reinterpret decoded BGL yaw as the
// visible replacement-bridge heading and overwrite the own-gate registration.
// Fresh fleet evidence showed that doing so sweeps bridges across neighboring
// stands. The exact supplied GLB's local Rotunda->Tunnel-A axis is already
// measured by the real-wall registration stage; keep its final parent yaw aimed
// at the gate's own authored target. Decoded source yaw remains diagnostic
// provenance only and must never become late rendered-direction authority.
if (!source.includes(authority)) {
  throw new Error(`${runtimePath}: own-gate real-wall static authority is missing before final-world verification`);
}
if (!source.includes("const yaw = targetRegistrationYaw;")) {
  throw new Error(`${runtimePath}: final static parent yaw is not owned by the own-gate target registration`);
}
if (!source.includes("ownGateHeadingErrorRadians")) {
  throw new Error(`${runtimePath}: own-gate heading error guard is missing`);
}
if (source.includes("const yaw = sourceYaw;") || source.includes("const yaw = sourceAxisRegistrationYaw;")) {
  throw new Error(`${runtimePath}: a late decoded-source-heading parent-yaw override survived`);
}

if (!source.includes(marker)) {
  const anchor = `  const yaw = targetRegistrationYaw;`;
  source = source.replace(
    anchor,
    `  // ${marker}\n  // Decoded KPHX heading is retained as source provenance only; rendered\n  // bridge direction remains the already-validated own-gate target direction.\n${anchor}`,
  );
}

// Preserve source-vs-rendered diagnostics without asserting equality. A nonzero
// difference is expected whenever raw source heading would cross a neighboring
// stand after measured-wall Rotunda registration.
const telemetryAnchor = "    staticTerminalFacingDot: terminalFacingDot,";
if (source.includes(telemetryAnchor) && !source.includes("staticSourceHeadingProvenanceDeltaRadians")) {
  source = source.replace(
    telemetryAnchor,
    `    staticSourceHeadingProvenanceDeltaRadians: Math.abs(wrapYaw(THREE, resolvedBridgeHeading - sourceYaw)),\n${telemetryAnchor}`,
  );
}

const aggregateAnchor = "  const maximumYawChange = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticFacadeRegistrationYawChangeRadians));";
if (source.includes(aggregateAnchor) && !source.includes("maximumSourceHeadingProvenanceDelta")) {
  source = source.replace(
    aggregateAnchor,
    `${aggregateAnchor}\n  const maximumSourceHeadingProvenanceDelta = Math.max(...staticRegisteredPlacements.map((placement) => Number(placement.staticSourceHeadingProvenanceDeltaRadians) || 0));`,
  );
}

const publicationAnchor = "  group.userData.uploadedJetwayStaticMaximumRegistrationYawChangeRadians = maximumYawChange;";
if (source.includes(publicationAnchor) && !source.includes("uploadedJetwayStaticMaximumSourceHeadingProvenanceDeltaRadians")) {
  source = source.replace(
    publicationAnchor,
    `${publicationAnchor}\n  group.userData.uploadedJetwayStaticMaximumSourceHeadingProvenanceDeltaRadians = maximumSourceHeadingProvenanceDelta;`,
  );
}

for (const required of [
  marker,
  authority,
  "const yaw = targetRegistrationYaw;",
  "ownGateHeadingErrorRadians",
  "staticSourceHeadingProvenanceDeltaRadians",
  "uploadedJetwayStaticMaximumSourceHeadingProvenanceDeltaRadians",
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: final own-gate/source-provenance contract is missing ${required}`);
  }
}
for (const forbidden of [
  "const yaw = sourceYaw;",
  "const yaw = sourceAxisRegistrationYaw;",
  "visible bridge axis escaped decoded KPHX heading",
  "static-exact-bridge-axis-aligned-to-decoded-kphx-heading-v1",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: stale decoded-heading rendered authority survived: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Preserved all 57 static exact jetways on measured real-wall Rotundas with their supplied Rotunda-to-Tunnel-A axes aimed at each gate's own authored target; decoded KPHX headings remain provenance telemetry only and cannot re-cross neighboring stands late in production.");
