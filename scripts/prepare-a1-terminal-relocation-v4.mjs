import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const ELBOW_AUTHORITY = "same-day-photo-authored-opening-fixed-rotunda-elbow-terminal-aligned-v7";
const MEASUREMENT_AUTHORITY = "fixed-rotunda-measured-wall-and-cab-no-relocation-v26";
const MIN_TERMINAL_ALIGNMENT = 0.985;

if (!source.includes(`A1_PARENT_ORIENTATION_AUTHORITY = "${ELBOW_AUTHORITY}"`)) {
  throw new Error(`${installationPath}: physical Rotunda elbow must exist before final endpoint measurement`);
}
if (!source.includes("const measuredTerminalAlignment = alignedOpeningDirection.dot(terminalDirection)")) {
  throw new Error(`${installationPath}: physically aligned Rotunda aperture measurement is missing`);
}
if (!source.includes("const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius")) {
  throw new Error(`${installationPath}: measured short terminal leg is missing before final endpoint measurement`);
}

const placementAnchor = `  const correctedA1Placement = Object.freeze({
    ...a1Placement,
    wallConnectorLength: terminalDistance + SOURCE_WALL_LENGTH_PADDING_METERS,
  });`;

if (!source.includes("fixedRotundaEndpointMeasurementAuthority")) {
  if (!source.includes(placementAnchor)) {
    throw new Error(`${installationPath}: corrected A1 placement anchor is missing for non-relocating endpoint measurement`);
  }
  const measurementBlock = `  // ${MEASUREMENT_AUTHORITY}
  // Measure the final physical endpoints without moving A1. The Rotunda aperture
  // already faces the real terminal wall and the aircraft-side chain already has
  // its accepted gate pose. Any non-zero terminal relocation from this point on
  // would destroy the real elbow.
  const cabContactMesh = a1Model.getObjectByName("Cab_Jetway_0");
  const rotundaContactMesh = a1Model.getObjectByName("Rotunda_Jetway_0");
  if (!cabContactMesh?.isMesh || !rotundaContactMesh?.isMesh) {
    throw new Error("A1 final endpoint measurement requires the exact Cab and Rotunda meshes");
  }
  const cabContactVertices = transformedGeometryVertices(THREE, fleet, cabContactMesh);
  const cabCenterForContact = vertexCentroid(THREE, cabContactVertices);
  const rotundaCenterForContact = vertexCentroid(
    THREE,
    transformedGeometryVertices(THREE, fleet, rotundaContactMesh),
  );
  const cabDirectionLocal = cabCenterForContact.clone().sub(rotundaCenterForContact);
  cabDirectionLocal.y = 0;
  if (cabDirectionLocal.lengthSq() < 1) throw new Error("A1 final Cab contact direction is degenerate");
  cabDirectionLocal.normalize();
  let cabContactProjection = Number.NEGATIVE_INFINITY;
  for (const vertex of cabContactVertices) {
    cabContactProjection = Math.max(
      cabContactProjection,
      (vertex.x - cabCenterForContact.x) * cabDirectionLocal.x
        + (vertex.z - cabCenterForContact.z) * cabDirectionLocal.z,
    );
  }
  const cabEndFaceVertices = cabContactVertices.filter((vertex) => {
    const projection = (vertex.x - cabCenterForContact.x) * cabDirectionLocal.x
      + (vertex.z - cabCenterForContact.z) * cabDirectionLocal.z;
    return projection >= cabContactProjection - 0.12;
  });
  if (cabEndFaceVertices.length < 3) throw new Error(\`A1 final Cab contact face has too few vertices: \${cabEndFaceVertices.length}\`);
  const cabContactLocal = vertexCentroid(THREE, cabEndFaceVertices);
  group.updateMatrixWorld(true);
  fleet.updateWorldMatrix(true, true);
  a1Model.updateWorldMatrix(true, true);
  const cabContactWorld = fleet.localToWorld(cabContactLocal.clone());
  const cabDirectionWorld = cabDirectionLocal.clone().transformDirection(fleet.matrixWorld).normalize();
  const finalRotundaCenterWorld = fleet.localToWorld(new THREE.Vector3(
    rotundaOpening.centerX,
    rotundaOpening.centerY,
    rotundaOpening.centerZ,
  ));
  const finalMeasuredTerminalWallWorld = fleet.localToWorld(new THREE.Vector3(
    terminalWallX,
    rotundaOpening.centerY,
    terminalWallZ,
  ));
  const terminalWallOffsetX = terminalWallX - rotundaOpening.centerX;
  const terminalWallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  const terminalCrossTrackErrorMeters = Math.abs(
    terminalWallOffsetX * -rotundaOpening.openingDirectionZ
      + terminalWallOffsetZ * rotundaOpening.openingDirectionX,
  );
  const finalRotundaToCabWorldMeters = cabContactWorld.distanceTo(finalRotundaCenterWorld);
  const finalRotundaToWallWorldMeters = finalMeasuredTerminalWallWorld.distanceTo(finalRotundaCenterWorld);
  if (measuredTerminalAlignment < ${MIN_TERMINAL_ALIGNMENT}) {
    throw new Error(\`A1 physical Rotunda aperture lost terminal alignment before final endpoint measurement: \${measuredTerminalAlignment}\`);
  }
  if (!Number.isFinite(terminalCrossTrackErrorMeters) || terminalCrossTrackErrorMeters > 0.08) {
    throw new Error(\`A1 physical Rotunda aperture misses the measured wall centerline: \${terminalCrossTrackErrorMeters} m\`);
  }

  const terminalRelocationX = 0;
  const terminalRelocationZ = 0;
  const terminalRelocationMeters = 0;
  const relocationX = 0;
  const relocationZ = 0;
  const relocationDistance = 0;
  const relocationDistanceError = 0;
  const openingAlignment = measuredTerminalAlignment;
  const fixedRotundaEndpointMeasurementAuthority = "${MEASUREMENT_AUTHORITY}";
  group.userData.uploadedJetwayA1TerminalRelocationX = 0;
  group.userData.uploadedJetwayA1TerminalRelocationZ = 0;
  group.userData.uploadedJetwayA1TerminalRelocationMeters = 0;
  group.userData.uploadedJetwayA1TotalRelocationX = 0;
  group.userData.uploadedJetwayA1TotalRelocationZ = 0;
  group.userData.uploadedJetwayA1TotalRelocationMeters = 0;
  group.userData.uploadedJetwayA1CabContactWorldX = cabContactWorld.x;
  group.userData.uploadedJetwayA1CabContactWorldY = cabContactWorld.y;
  group.userData.uploadedJetwayA1CabContactWorldZ = cabContactWorld.z;
  group.userData.uploadedJetwayA1CabDirectionWorldX = cabDirectionWorld.x;
  group.userData.uploadedJetwayA1CabDirectionWorldZ = cabDirectionWorld.z;
  group.userData.uploadedJetwayA1CabContactFaceVertexCount = cabEndFaceVertices.length;
  group.userData.uploadedJetwayA1TerminalRelocationDistanceErrorMeters = 0;
  group.userData.uploadedJetwayA1TerminalOpeningAlignment = measuredTerminalAlignment;
  group.userData.uploadedJetwayA1MinimumTerminalOpeningAlignment = ${MIN_TERMINAL_ALIGNMENT};
  group.userData.uploadedJetwayA1MeasuredTerminalWallX = terminalWallX;
  group.userData.uploadedJetwayA1MeasuredTerminalWallZ = terminalWallZ;
  group.userData.uploadedJetwayA1TerminalCrossTrackErrorMeters = terminalCrossTrackErrorMeters;
  group.userData.uploadedJetwayA1FinalRotundaWorldX = finalRotundaCenterWorld.x;
  group.userData.uploadedJetwayA1FinalRotundaWorldY = finalRotundaCenterWorld.y;
  group.userData.uploadedJetwayA1FinalRotundaWorldZ = finalRotundaCenterWorld.z;
  group.userData.uploadedJetwayA1FinalMeasuredWallWorldX = finalMeasuredTerminalWallWorld.x;
  group.userData.uploadedJetwayA1FinalMeasuredWallWorldY = finalMeasuredTerminalWallWorld.y;
  group.userData.uploadedJetwayA1FinalMeasuredWallWorldZ = finalMeasuredTerminalWallWorld.z;
  group.userData.uploadedJetwayA1FinalRotundaToCabWorldMeters = finalRotundaToCabWorldMeters;
  group.userData.uploadedJetwayA1FinalRotundaToWallWorldMeters = finalRotundaToWallWorldMeters;
  group.userData.uploadedJetwayA1FinalEndpointEvidenceAuthority = "exact-world-fixed-rotunda-wall-cab-endpoints-v32";
  group.userData.uploadedJetwayA1FixedRotundaEndpointMeasurementAuthority = fixedRotundaEndpointMeasurementAuthority;

${placementAnchor}`;
  source = source.replace(placementAnchor, measurementBlock);
}

source = source.replace(
  /const INSTALLATION_AUTHORITY = "[^"]+";/,
  `const INSTALLATION_AUTHORITY = "${MEASUREMENT_AUTHORITY}";`,
);

for (const required of [
  `INSTALLATION_AUTHORITY = "${MEASUREMENT_AUTHORITY}"`,
  `fixedRotundaEndpointMeasurementAuthority = "${MEASUREMENT_AUTHORITY}"`,
  "const terminalRelocationMeters = 0;",
  "const relocationDistance = 0;",
  "uploadedJetwayA1TerminalRelocationMeters = 0",
  "uploadedJetwayA1CabContactWorldX = cabContactWorld.x",
  "uploadedJetwayA1FinalRotundaWorldX = finalRotundaCenterWorld.x",
  "uploadedJetwayA1FinalMeasuredWallWorldX = finalMeasuredTerminalWallWorld.x",
  "uploadedJetwayA1FinalRotundaToCabWorldMeters",
  "uploadedJetwayA1TerminalCrossTrackErrorMeters",
  'uploadedJetwayA1FinalEndpointEvidenceAuthority = "exact-world-fixed-rotunda-wall-cab-endpoints-v32"',
]) {
  if (!source.includes(required)) throw new Error(`${installationPath}: non-relocating final endpoint measurement is missing ${required}`);
}
for (const forbidden of [
  "a1Anchor.position.x += terminalRelocationX",
  "a1Anchor.position.z += terminalRelocationZ",
  "desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "A1 relocated visible vestibule is wrong",
  "parent-matrix-committed-final-cab-contact-grounded-exact-chain-v25",
]) {
  if (source.includes(forbidden)) throw new Error(`${installationPath}: stale whole-A1 relocation survived physical elbow measurement: ${forbidden}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Measured A1's final Rotunda/wall/Cab endpoints without relocating the bridge: terminal relocation is hard-zero, the physically articulated aperture remains aligned to the real wall, and aircraft-side Cab telemetry is preserved for later registration.");
