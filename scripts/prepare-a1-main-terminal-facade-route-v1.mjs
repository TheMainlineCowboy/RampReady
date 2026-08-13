import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-main-terminal-facade-clear-route-v1";
const MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M = 100;
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  const footprintHelperAnchor = `  const pointInsideWalkwayFootprint = (x, z, footprint) => {
    const sign = (px, pz, ax, az, bx, bz) => (px - bx) * (az - bz) - (ax - bx) * (pz - bz);
    const d1 = sign(x, z, footprint.ax, footprint.az, footprint.bx, footprint.bz);
    const d2 = sign(x, z, footprint.bx, footprint.bz, footprint.cx, footprint.cz);
    const d3 = sign(x, z, footprint.cx, footprint.cz, footprint.ax, footprint.az);
    const hasNegative = d1 < -1e-6 || d2 < -1e-6 || d3 < -1e-6;
    const hasPositive = d1 > 1e-6 || d2 > 1e-6 || d3 > 1e-6;
    return !(hasNegative && hasPositive);
  };`;
  const footprintHelpers = `${footprintHelperAnchor}
  // ${marker}
  // The BGL jetway x/z is the AIR_Jetway01 model pivot, not the replacement
  // Rotunda. A wall does not have to sit on the model-heading ray. A1 instead
  // requires a broad main-terminal facade with a completely clear passenger
  // route back to the source pivot; any route crossing T4_WALK is rejected.
  const segmentOrientation = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  const segmentsIntersect2d = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const o1 = segmentOrientation(ax, az, bx, bz, cx, cz);
    const o2 = segmentOrientation(ax, az, bx, bz, dx, dz);
    const o3 = segmentOrientation(cx, cz, dx, dz, ax, az);
    const o4 = segmentOrientation(cx, cz, dx, dz, bx, bz);
    const epsilon = 1e-6;
    const onSegment = (px, pz, qx, qz, rx, rz) => (
      qx >= Math.min(px, rx) - epsilon && qx <= Math.max(px, rx) + epsilon
      && qz >= Math.min(pz, rz) - epsilon && qz <= Math.max(pz, rz) + epsilon
    );
    if (Math.abs(o1) <= epsilon && onSegment(ax, az, cx, cz, bx, bz)) return true;
    if (Math.abs(o2) <= epsilon && onSegment(ax, az, dx, dz, bx, bz)) return true;
    if (Math.abs(o3) <= epsilon && onSegment(cx, cz, ax, az, dx, dz)) return true;
    if (Math.abs(o4) <= epsilon && onSegment(cx, cz, bx, bz, dx, dz)) return true;
    return (o1 > epsilon) !== (o2 > epsilon) && (o3 > epsilon) !== (o4 > epsilon);
  };
  const segmentCrossesWalkwayFootprint = (ax, az, bx, bz, footprint) => (
    pointInsideWalkwayFootprint(ax, az, footprint)
    || pointInsideWalkwayFootprint(bx, bz, footprint)
    || segmentsIntersect2d(ax, az, bx, bz, footprint.ax, footprint.az, footprint.bx, footprint.bz)
    || segmentsIntersect2d(ax, az, bx, bz, footprint.bx, footprint.bz, footprint.cx, footprint.cz)
    || segmentsIntersect2d(ax, az, bx, bz, footprint.cx, footprint.cz, footprint.ax, footprint.az)
  );`;
  if (!source.includes(footprintHelperAnchor)) throw new Error(`${runtimePath}: T4_WALK footprint helper anchor is missing`);
  source = source.replace(footprintHelperAnchor, footprintHelpers);

  const overlapBlock = `      if (underElevatedWalkway) {
        diagnostics.walkwayOverlapRejectedCount += 1;
        continue;
      }
      const candidateDirection = new THREE.Vector3(dx, 0, dz).normalize();`;
  const routeBlock = `      if (underElevatedWalkway) {
        diagnostics.walkwayOverlapRejectedCount += 1;
        continue;
      }
      const routeCrossesElevatedWalkway = forcePreferredHemisphere && elevatedWalkwayFootprints.some((footprint) => (
        footprint.minimumY > closest.y + 1
        && segmentCrossesWalkwayFootprint(closest.x, closest.z, originX, originZ, footprint)
      ));
      if (routeCrossesElevatedWalkway) {
        diagnostics.walkwayRouteRejectedCount = (diagnostics.walkwayRouteRejectedCount || 0) + 1;
        continue;
      }
      if (forcePreferredHemisphere && area < ${MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M}) {
        diagnostics.narrowFacadeRejectedCount = (diagnostics.narrowFacadeRejectedCount || 0) + 1;
        diagnostics.minimumMainFacadeTriangleAreaSqM = ${MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M};
        continue;
      }
      const candidateDirection = new THREE.Vector3(dx, 0, dz).normalize();`;
  if (!source.includes(overlapBlock)) throw new Error(`${runtimePath}: A1 walkway-overlap candidate block is missing`);
  source = source.replace(overlapBlock, routeBlock);

  const oldDirectionGate = `      const minimumDirectionDot = forcePreferredHemisphere ? 0.9 : 0.15;
      if (requirePreferredHemisphere && directionDot < minimumDirectionDot) {`;
  const newDirectionGate = `      // ${marker}: source heading remains parent-yaw provenance, not wall ownership.
      const minimumDirectionDot = forcePreferredHemisphere ? -1 : 0.15;
      if (requirePreferredHemisphere && directionDot < minimumDirectionDot) {`;
  if (!source.includes(oldDirectionGate)) throw new Error(`${runtimePath}: source-direction candidate gate is missing`);
  source = source.replace(oldDirectionGate, newDirectionGate);

  const oldPenalty = `      const directionPenalty = requirePreferredHemisphere ? Math.max(0, 1 - directionDot) * 2.5 : 0;`;
  const newPenalty = `      const directionPenalty = requirePreferredHemisphere && !forcePreferredHemisphere
        ? Math.max(0, 1 - directionDot) * 2.5
        : 0;`;
  if (!source.includes(oldPenalty)) throw new Error(`${runtimePath}: candidate direction penalty is missing`);
  source = source.replace(oldPenalty, newPenalty);

  const oldCandidateFields = `          triangleArea: area,
          materialReference,
          underElevatedWalkway: false,
          elevatedWalkwayClearanceVerified: true,
          sourceHierarchyWalkwayExcluded: true,`;
  const newCandidateFields = `          triangleArea: area,
          materialReference,
          underElevatedWalkway: false,
          elevatedWalkwayClearanceVerified: true,
          walkwayRouteClearToSourcePivot: !routeCrossesElevatedWalkway,
          mainTerminalFacadeVerified: !forcePreferredHemisphere || area >= ${MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M},
          minimumMainFacadeTriangleAreaSqM: forcePreferredHemisphere ? ${MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M} : null,
          sourceHierarchyWalkwayExcluded: true,`;
  if (!source.includes(oldCandidateFields)) throw new Error(`${runtimePath}: structural candidate result fields are missing`);
  source = source.replace(oldCandidateFields, newCandidateFields);

  const oldGroundedDirectionGate = `      if (!(groundedTerminalDirectionDot >= 0.9)) {
        throw new Error(\`A1 grounded decoded-KPHX terminal-side direction is invalid: directionDot=\${groundedTerminalDirectionDot}; minimum=0.9; connection=\${JSON.stringify(groundedConnection)}\`);
      }`;
  const newGroundedDirectionGate = `      if (!Number.isFinite(groundedTerminalDirectionDot)) {
        throw new Error(\`A1 grounded main-terminal source-heading diagnostic is not finite: \${groundedTerminalDirectionDot}\`);
      }
      if (groundedConnection.walkwayRouteClearToSourcePivot !== true
        || groundedConnection.mainTerminalFacadeVerified !== true
        || !(Number(groundedConnection.triangleArea) >= ${MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M})) {
        throw new Error(\`A1 grounded wall is not the broad main-terminal facade with a clear T4_WALK-free source-pivot route: \${JSON.stringify(groundedConnection)}\`);
      }`;
  if (!source.includes(oldGroundedDirectionGate)) throw new Error(`${runtimePath}: A1 grounded source-direction acceptance gate is missing`);
  source = source.replace(oldGroundedDirectionGate, newGroundedDirectionGate);

  source = source.replace(
    `wallSelectionVectorAuthority: "decoded-kphx-bgl-heading-terminal-side-v4",`,
    `wallSelectionVectorAuthority: "${marker}",`,
  );
  source = source.replace(
    `minimumRequiredDirectionDot: 0.9,`,
    `minimumRequiredDirectionDot: null,\n        minimumMainFacadeTriangleAreaSqM: ${MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M},\n        walkwayRouteRejectedCount: diagnostics?.walkwayRouteRejectedCount ?? 0,\n        narrowFacadeRejectedCount: diagnostics?.narrowFacadeRejectedCount ?? 0,`,
  );

  const oldUpperDirectionGate = `      if (!(fullHeightUpperSourceDot >= 0.9)) {
        throw new Error(\`A1 Rotunda-height facade is not aligned to decoded KPHX heading: dot=\${fullHeightUpperSourceDot}\`);
      }`;
  const newUpperDirectionGate = `      if (!Number.isFinite(fullHeightUpperSourceDot)) {
        throw new Error(\`A1 Rotunda-height source-heading diagnostic is not finite: \${fullHeightUpperSourceDot}\`);
      }
      if (fullHeightUpperConnection.walkwayRouteClearToSourcePivot !== true
        || fullHeightUpperConnection.mainTerminalFacadeVerified !== true
        || !(Number(fullHeightUpperConnection.triangleArea) >= ${MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M})) {
        throw new Error(\`A1 Rotunda-height wall is not the broad main-terminal facade with a clear T4_WALK-free source-pivot route: \${JSON.stringify(fullHeightUpperConnection)}\`);
      }`;
  if (!source.includes(oldUpperDirectionGate)) throw new Error(`${runtimePath}: A1 upper source-direction acceptance gate is missing`);
  source = source.replace(oldUpperDirectionGate, newUpperDirectionGate);

  source = source.replace(
    `terminalConnection.authority = "a1-decoded-kphx-full-height-terminal-building-wall-v31";`,
    `terminalConnection.authority = "a1-main-terminal-full-height-facade-clear-route-v32";`,
  );
  source = source.replace(
    `terminalConnection.fullHeightUpperSourceDirectionDot = fullHeightUpperSourceDot;`,
    `terminalConnection.fullHeightUpperSourceDirectionDot = fullHeightUpperSourceDot;\n      terminalConnection.mainTerminalFacadeAuthority = "${marker}";\n      terminalConnection.walkwayRouteClearToSourcePivot = true;`,
  );
}

for (const required of [
  marker,
  "segmentCrossesWalkwayFootprint",
  "walkwayRouteRejectedCount",
  "narrowFacadeRejectedCount",
  `area < ${MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M}`,
  "walkwayRouteClearToSourcePivot",
  "mainTerminalFacadeVerified",
  `minimumMainFacadeTriangleAreaSqM: ${MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M}`,
  'wallSelectionVectorAuthority: "a1-main-terminal-facade-clear-route-v1"',
  'a1-main-terminal-full-height-facade-clear-route-v32',
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: final A1 main-terminal facade contract is missing ${required}`);
}
for (const forbidden of [
  "forcePreferredHemisphere ? 0.9 : 0.15",
  "groundedTerminalDirectionDot >= 0.9",
  "fullHeightUpperSourceDot >= 0.9",
  'wallSelectionVectorAuthority: "decoded-kphx-bgl-heading-terminal-side-v4"',
  'terminalConnection.authority = "a1-decoded-kphx-full-height-terminal-building-wall-v31"',
]) {
  if (source.includes(forbidden)) throw new Error(`${runtimePath}: stale heading-ray wall ownership survived: ${forbidden}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Prepared A1 main-terminal wall ownership from a >=${MINIMUM_MAIN_FACADE_TRIANGLE_AREA_SQ_M} m² broad facade with a zero-T4_WALK route to the AIR_Jetway01 source pivot; decoded KPHX heading remains parent-yaw provenance only.`);
