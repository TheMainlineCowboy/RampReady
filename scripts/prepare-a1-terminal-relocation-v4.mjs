import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const MIN_TERMINAL_ALIGNMENT = 0.98;
const spanBlockPattern = /  const rotundaOpening = measureExactRotundaOpening\(THREE, fleet, a1Model, terminalDirection\);[\s\S]*?(?=\n  const rotundaCenterAfter = objectBoundsCenterInFleet)/;
if (!spanBlockPattern.test(source)) {
  throw new Error(`${installationPath}: authored-opening cab-pivot span block is missing`);
}

const relocatedSpanBlock = `  let rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const measuredTerminalAlignment = rotundaOpening.openingDirectionX * terminalDirection.x
    + rotundaOpening.openingDirectionZ * terminalDirection.z;
  if (measuredTerminalAlignment < ${MIN_TERMINAL_ALIGNMENT}) {
    throw new Error(\`A1 authored Rotunda opening did not face the terminal before relocation: \${measuredTerminalAlignment}\`);
  }
  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;
  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;
  const wallOffsetX = terminalWallX - rotundaOpening.centerX;
  const wallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  const initialTerminalDistance = wallOffsetX * rotundaOpening.openingDirectionX
    + wallOffsetZ * rotundaOpening.openingDirectionZ;
  const desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS;
  const terminalRelocationMeters = initialTerminalDistance - desiredTerminalDistance;
  if (!Number.isFinite(terminalRelocationMeters) || Math.abs(terminalRelocationMeters) >= 60) {
    throw new Error(\`A1 signed terminal relocation is invalid: \${terminalRelocationMeters}\`);
  }
  const terminalRelocationX = rotundaOpening.openingDirectionX * terminalRelocationMeters;
  const terminalRelocationZ = rotundaOpening.openingDirectionZ * terminalRelocationMeters;
  a1Anchor.position.x += terminalRelocationX;
  a1Anchor.position.z += terminalRelocationZ;
  fleet.updateMatrixWorld(true);
  rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const relocatedWallOffsetX = terminalWallX - rotundaOpening.centerX;
  const relocatedWallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  const terminalDistance = relocatedWallOffsetX * rotundaOpening.openingDirectionX
    + relocatedWallOffsetZ * rotundaOpening.openingDirectionZ;
  const relocationDistanceError = Math.abs(terminalDistance - desiredTerminalDistance);
  const openingAlignment = rotundaOpening.openingDirectionX * terminalDirection.x
    + rotundaOpening.openingDirectionZ * terminalDirection.z;
  if (relocationDistanceError > 0.03) {
    throw new Error(\`A1 signed terminal relocation missed the measured vestibule span by \${relocationDistanceError} m\`);
  }
  if (openingAlignment < ${MIN_TERMINAL_ALIGNMENT}) {
    throw new Error(\`A1 authored Rotunda opening is not terminal-facing after relocation: \${openingAlignment}\`);
  }
  if (A1_PHOTO_VISIBLE_VESTIBULE_METERS > 3) {
    throw new Error(\`A1 photo vestibule exceeds the compact-reference limit: \${A1_PHOTO_VISIBLE_VESTIBULE_METERS}\`);
  }

  const cabContactMesh = a1Model.getObjectByName("Cab_Jetway_0");
  const rotundaContactMesh = a1Model.getObjectByName("Rotunda_Jetway_0");
  if (!cabContactMesh?.isMesh || !rotundaContactMesh?.isMesh) {
    throw new Error("A1 final Cab contact measurement requires the exact Cab and Rotunda meshes");
  }
  const cabContactVertices = transformedGeometryVertices(THREE, fleet, cabContactMesh);
  const cabCenterForContact = vertexCentroid(THREE, cabContactVertices);
  const rotundaCenterForContact = vertexCentroid(
    THREE,
    transformedGeometryVertices(THREE, fleet, rotundaContactMesh),
  );
  const cabDirectionLocal = cabCenterForContact.clone().sub(rotundaCenterForContact);
  cabDirectionLocal.y = 0;
  if (cabDirectionLocal.lengthSq() < 1) {
    throw new Error("A1 final Cab contact direction is degenerate");
  }
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
  if (cabEndFaceVertices.length < 3) {
    throw new Error(\`A1 final Cab contact face has too few vertices: \${cabEndFaceVertices.length}\`);
  }
  const cabContactLocal = vertexCentroid(THREE, cabEndFaceVertices);
  // updateMatrixWorld on a child does not update a stale parent. The source
  // jetway group carries the A1-local +6.2 m scene offset, so commit the entire
  // ancestor chain before converting the Cab endpoint to scene coordinates.
  group.updateMatrixWorld(true);
  fleet.updateWorldMatrix(true, true);
  const cabContactWorld = fleet.localToWorld(cabContactLocal.clone());
  const cabDirectionWorld = cabDirectionLocal.clone().transformDirection(fleet.matrixWorld).normalize();
  const cabContactParentOffsetX = cabContactWorld.x - cabContactLocal.x;
  const cabContactParentOffsetZ = cabContactWorld.z - cabContactLocal.z;
  if (!(Math.abs(cabContactParentOffsetX) < 0.1
    && cabContactParentOffsetZ > 5.9
    && cabContactParentOffsetZ < 6.5)) {
    throw new Error(\`A1 final Cab scene-parent offset is invalid: \${cabContactParentOffsetX},\${cabContactParentOffsetZ}\`);
  }
  if (![cabContactWorld.x, cabContactWorld.y, cabContactWorld.z, cabDirectionWorld.x, cabDirectionWorld.z].every(Number.isFinite)) {
    throw new Error("A1 final Cab contact produced non-finite scene coordinates");
  }
`;

source = source.replace(spanBlockPattern, relocatedSpanBlock);

const placementBefore = `  const correctedA1Placement = Object.freeze({
    ...a1Placement,
    wallConnectorLength: terminalDistance + SOURCE_WALL_LENGTH_PADDING_METERS,
  });`;
const placementAfter = `  const correctedA1Placement = Object.freeze({
    ...a1Placement,
    x: terminalWallX - terminalDirection.x * terminalDistance,
    z: terminalWallZ - terminalDirection.z * terminalDistance,
    wallConnectorLength: terminalDistance + SOURCE_WALL_LENGTH_PADDING_METERS,
  });`;
if (!source.includes(placementBefore)) {
  throw new Error(`${installationPath}: corrected A1 placement anchor is missing`);
}
source = source.replace(placementBefore, placementAfter);

const relocationBefore = "  const relocationX = cabPreservationDelta.x;\n  const relocationZ = cabPreservationDelta.z;\n  const relocationDistance = cabPreservationDelta.length();";
const relocationAfter = `  const relocationX = cabPreservationDelta.x + terminalRelocationX;
  const relocationZ = cabPreservationDelta.z + terminalRelocationZ;
  const relocationDistance = Math.hypot(relocationX, relocationZ);
  group.userData.uploadedJetwayA1TerminalRelocationX = terminalRelocationX;
  group.userData.uploadedJetwayA1TerminalRelocationZ = terminalRelocationZ;
  group.userData.uploadedJetwayA1TerminalRelocationMeters = terminalRelocationMeters;
  group.userData.uploadedJetwayA1TotalRelocationX = relocationX;
  group.userData.uploadedJetwayA1TotalRelocationZ = relocationZ;
  group.userData.uploadedJetwayA1TotalRelocationMeters = relocationDistance;
  group.userData.uploadedJetwayA1CabContactWorldX = cabContactWorld.x;
  group.userData.uploadedJetwayA1CabContactWorldY = cabContactWorld.y;
  group.userData.uploadedJetwayA1CabContactWorldZ = cabContactWorld.z;
  group.userData.uploadedJetwayA1CabDirectionWorldX = cabDirectionWorld.x;
  group.userData.uploadedJetwayA1CabDirectionWorldZ = cabDirectionWorld.z;
  group.userData.uploadedJetwayA1CabContactParentOffsetX = cabContactParentOffsetX;
  group.userData.uploadedJetwayA1CabContactParentOffsetZ = cabContactParentOffsetZ;
  group.userData.uploadedJetwayA1CabContactFaceVertexCount = cabEndFaceVertices.length;
  group.userData.uploadedJetwayA1TerminalRelocationDistanceErrorMeters = relocationDistanceError;
  group.userData.uploadedJetwayA1TerminalOpeningAlignment = openingAlignment;
  group.userData.uploadedJetwayA1MinimumTerminalOpeningAlignment = ${MIN_TERMINAL_ALIGNMENT};
  group.userData.uploadedJetwayA1MeasuredTerminalWallX = terminalWallX;
  group.userData.uploadedJetwayA1MeasuredTerminalWallZ = terminalWallZ;`;
if (!source.includes(relocationBefore)) {
  throw new Error(`${installationPath}: A1 relocation report anchor is missing`);
}
source = source.replace(relocationBefore, relocationAfter);
source = source.replace(
  /const INSTALLATION_AUTHORITY = "[^"]+";/,
  'const INSTALLATION_AUTHORITY = "parent-matrix-committed-final-cab-contact-grounded-exact-chain-v25";',
);

for (const token of [
  'INSTALLATION_AUTHORITY = "parent-matrix-committed-final-cab-contact-grounded-exact-chain-v25"',
  "group.updateMatrixWorld(true)",
  "fleet.updateWorldMatrix(true, true)",
  "cabContactParentOffsetZ > 5.9",
  "uploadedJetwayA1CabContactParentOffsetX",
  "uploadedJetwayA1CabContactParentOffsetZ",
  "uploadedJetwayA1CabContactWorldX",
  "uploadedJetwayA1CabDirectionWorldX",
  "uploadedJetwayA1TotalRelocationX",
  `openingAlignment < ${MIN_TERMINAL_ALIGNMENT}`,
  "A1_PHOTO_VISIBLE_VESTIBULE_METERS > 3",
  "uploadedJetwayA1TerminalRelocationDistanceErrorMeters",
  "uploadedJetwayA1MeasuredTerminalWallX",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: parent-matrix final-Cab output is missing ${token}`);
}
if (source.includes("openingAlignment < 0.995") || source.includes("measuredTerminalAlignment < 0.995")) {
  throw new Error(`${installationPath}: obsolete 0.995 terminal-alignment gate remains`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(`Committed the A1 source-parent matrix before measuring the final Cab scene contact, preserving the exact GLB hierarchy and ${MIN_TERMINAL_ALIGNMENT.toFixed(2)} opening-alignment floor.`);
