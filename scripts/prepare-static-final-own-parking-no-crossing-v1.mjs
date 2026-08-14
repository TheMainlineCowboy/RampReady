import fs from "node:fs";

const runtimePath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const marker = "static-final-kphx-own-parking-rigid-bridge-v1";
const physicalAuthority = "57-static-kphx-own-parking-real-wall-registration-v12";
const crossingAuthority = "57-static-kphx-own-parking-final-occupied-centerline-no-crossing-v2";
const overlapAuthority = "57-static-exact-glb-final-part-envelope-no-overlap-v1";
const overlapToleranceMeters = 0.05;
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  const sourceYawLine = "  const yaw = sourceAxisRegistrationYaw;";
  if (!source.includes(sourceYawLine)) throw new Error(`${runtimePath}: decoded-BGL whole-bridge yaw is missing before final static correction`);
  source = source.replace(
    sourceYawLine,
    `  // ${marker}\n  // AIR_Jetway01 is articulated: decoded BGL yaw is stock base provenance,\n  // while the KPHX jetway->own-parking geometry owns the rigid replacement arm.\n  const yaw = targetRegistrationYaw;`,
  );

  const oldSourceFailure = `  if (sourceBridgeHeadingErrorRadians > 1e-9) {\n    throw new Error(\`Static jetway \${placement.gate} visible bridge axis escaped decoded KPHX heading: \${sourceBridgeHeadingErrorRadians} rad\`);\n  }`;
  if (!source.includes(oldSourceFailure)) throw new Error(`${runtimePath}: static BGL visible-axis hard failure is missing`);
  source = source.replace(oldSourceFailure, "");

  const ownGateAnchor = "  const ownGateHeadingErrorRadians = Math.abs(wrapYaw(THREE, resolvedBridgeHeading - targetHeading));";
  if (!source.includes(ownGateAnchor)) throw new Error(`${runtimePath}: own-gate heading telemetry is missing`);
  source = source.replace(
    ownGateAnchor,
    `${ownGateAnchor}\n  if (ownGateHeadingErrorRadians > 0.002) {\n    throw new Error(\`Static jetway \${placement.gate} escaped its KPHX-authored own-parking centerline: \${ownGateHeadingErrorRadians} rad\`);\n  }`,
  );

  const terminalDotAnchor = "  const terminalFacingDot = bridgeUnitX * ux + bridgeUnitZ * uz;";
  if (!source.includes(terminalDotAnchor)) throw new Error(`${runtimePath}: terminal-facing telemetry is missing`);
  source = source.replace(
    terminalDotAnchor,
    `${terminalDotAnchor}\n  if (terminalFacingDot > 0.25) {\n    throw new Error(\`Static jetway \${placement.gate} points back toward Terminal 4 instead of its own KPHX stand: dot=\${terminalFacingDot}\`);\n  }`,
  );

  const exportAnchor = "export function registerStaticJetwayFleetToFacade(THREE, group, fleet, placements) {";
  if (!source.includes(exportAnchor)) throw new Error(`${runtimePath}: static registration export is missing`);
  source = source.replace(
    exportAnchor,
    `function staticCenterlinesProperlyIntersect(a, b) {\n  const values = [a.x, a.z, a.targetX, a.targetZ, b.x, b.z, b.targetX, b.targetZ].map(Number);\n  if (!values.every(Number.isFinite)) return true;\n  const [ax, az, atx, atz, bx, bz, btx, btz] = values;\n  const cross = (x1, z1, x2, z2, x3, z3) => (x2 - x1) * (z3 - z1) - (z2 - z1) * (x3 - x1);\n  const d1 = cross(ax, az, atx, atz, bx, bz);\n  const d2 = cross(ax, az, atx, atz, btx, btz);\n  const d3 = cross(bx, bz, btx, btz, ax, az);\n  const d4 = cross(bx, bz, btx, btz, atx, atz);\n  return d1 * d2 < -1e-6 && d3 * d4 < -1e-6;\n}\n\nfunction staticCenterlineDistanceMeters(a, b) {\n  if (staticCenterlinesProperlyIntersect(a, b)) return 0;\n  const pointToSegment = (px, pz, ax, az, bx, bz) => {\n    const dx = bx - ax;\n    const dz = bz - az;\n    const lengthSquared = dx * dx + dz * dz;\n    if (!(lengthSquared > 1e-9)) return Math.hypot(px - ax, pz - az);\n    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSquared));\n    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));\n  };\n  const ax = Number(a.x); const az = Number(a.z); const atx = Number(a.targetX); const atz = Number(a.targetZ);\n  const bx = Number(b.x); const bz = Number(b.z); const btx = Number(b.targetX); const btz = Number(b.targetZ);\n  if (![ax, az, atx, atz, bx, bz, btx, btz].every(Number.isFinite)) return 0;\n  return Math.min(\n    pointToSegment(ax, az, bx, bz, btx, btz),\n    pointToSegment(atx, atz, bx, bz, btx, btz),\n    pointToSegment(bx, bz, ax, az, atx, atz),\n    pointToSegment(btx, btz, ax, az, atx, atz),\n  );\n}\n\nfunction staticFinalOccupiedCenterline(placement) {\n  const x = Number(placement.x);\n  const z = Number(placement.z);\n  const authoredTargetX = Number(placement.targetX);\n  const authoredTargetZ = Number(placement.targetZ);\n  const finalContactDistance = Number(placement.staticPostRegistrationPredictedContactDistanceMeters);\n  const authoredDistance = Math.hypot(authoredTargetX - x, authoredTargetZ - z);\n  if (![x, z, authoredTargetX, authoredTargetZ, finalContactDistance, authoredDistance].every(Number.isFinite)\n    || !(authoredDistance > 0.5) || !(finalContactDistance > 0.5)) {\n    throw new Error(\`Static jetway \${placement.gate} has invalid final occupied-centerline evidence\`);\n  }\n  const occupiedDistance = Math.min(authoredDistance, finalContactDistance);\n  const ux = (authoredTargetX - x) / authoredDistance;\n  const uz = (authoredTargetZ - z) / authoredDistance;\n  return { gate: placement.gate, x, z, targetX: x + ux * occupiedDistance, targetZ: z + uz * occupiedDistance, occupiedDistance };\n}\n\nfunction staticConvexHullXZ(points) {\n  const unique = [];\n  for (const point of points) {\n    if (!unique.some((candidate) => Math.hypot(candidate.x - point.x, candidate.z - point.z) < 1e-7)) unique.push(point);\n  }\n  unique.sort((a, b) => a.x - b.x || a.z - b.z);\n  if (unique.length <= 2) return unique;\n  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);\n  const lower = [];\n  for (const point of unique) {\n    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-8) lower.pop();\n    lower.push(point);\n  }\n  const upper = [];\n  for (let index = unique.length - 1; index >= 0; index -= 1) {\n    const point = unique[index];\n    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-8) upper.pop();\n    upper.push(point);\n  }\n  lower.pop();\n  upper.pop();\n  return lower.concat(upper);\n}\n\nfunction staticExactInstanceEnvelope(THREE, batch, instanceIndex) {\n  const geometry = batch.geometry;\n  if (!geometry) throw new Error(\`Static exact primitive \${batch.name} has no geometry\`);\n  if (!geometry.boundingBox) geometry.computeBoundingBox();\n  const bounds = geometry.boundingBox;\n  if (!bounds || bounds.isEmpty()) throw new Error(\`Static exact primitive \${batch.name} has empty bounds\`);\n  const matrix = new THREE.Matrix4();\n  batch.getMatrixAt(instanceIndex, matrix);\n  const corners = [];\n  let minY = Infinity;\n  let maxY = -Infinity;\n  for (const x of [bounds.min.x, bounds.max.x]) {\n    for (const y of [bounds.min.y, bounds.max.y]) {\n      for (const z of [bounds.min.z, bounds.max.z]) {\n        const world = new THREE.Vector3(x, y, z).applyMatrix4(matrix);\n        corners.push({ x: world.x, z: world.z });\n        minY = Math.min(minY, world.y);\n        maxY = Math.max(maxY, world.y);\n      }\n    }\n  }\n  const hull = staticConvexHullXZ(corners);\n  if (hull.length < 3 || ![minY, maxY].every(Number.isFinite)) {\n    throw new Error(\`Static exact primitive \${batch.name} produced a degenerate final envelope\`);\n  }\n  return { part: batch.userData?.sourcePartName || batch.name, hull, minY, maxY };\n}\n\nfunction staticEnvelopeOverlapDepthXZ(left, right) {\n  const verticalOverlap = Math.min(left.maxY, right.maxY) - Math.max(left.minY, right.minY);\n  if (verticalOverlap <= ${overlapToleranceMeters}) return 0;\n  let minimumOverlap = Infinity;\n  for (const polygon of [left.hull, right.hull]) {\n    for (let index = 0; index < polygon.length; index += 1) {\n      const a = polygon[index];\n      const b = polygon[(index + 1) % polygon.length];\n      const edgeX = b.x - a.x;\n      const edgeZ = b.z - a.z;\n      const length = Math.hypot(edgeX, edgeZ);\n      if (!(length > 1e-8)) continue;\n      const axisX = -edgeZ / length;\n      const axisZ = edgeX / length;\n      const project = (hull) => {\n        let min = Infinity;\n        let max = -Infinity;\n        for (const point of hull) {\n          const value = point.x * axisX + point.z * axisZ;\n          min = Math.min(min, value);\n          max = Math.max(max, value);\n        }\n        return { min, max };\n      };\n      const p1 = project(left.hull);\n      const p2 = project(right.hull);\n      const overlap = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);\n      if (overlap <= ${overlapToleranceMeters}) return 0;\n      minimumOverlap = Math.min(minimumOverlap, overlap);\n    }\n  }\n  return Number.isFinite(minimumOverlap) ? minimumOverlap : 0;\n}\n\n${exportAnchor}`,
  );

  const lengthPassAnchor = `  applyPostRegistrationLengthToStaticInstances(\n    THREE,\n    staticBatches,\n    staticOriginalPlacements,\n    staticRegisteredPlacements,\n    staticSourceContactDistance,\n  );`;
  if (!source.includes(lengthPassAnchor)) throw new Error(`${runtimePath}: final static post-registration length pass is missing`);
  source = source.replace(
    lengthPassAnchor,
    `${lengthPassAnchor}\n\n  // The final collision authority uses the seven exact supplied primitive\n  // envelopes after wall registration and inward-only telescoping. A single\n  // 5.49 m Cab-width threshold is invalid along narrower Tunnel sections.\n  const finalOccupiedCenterlines = staticRegisteredPlacements.map(staticFinalOccupiedCenterline);\n  const staticCenterlineCrossings = [];\n  let minimumStaticCenterlineClearanceMeters = Infinity;\n  let minimumStaticCenterlineClearancePair = null;\n  for (let leftIndex = 0; leftIndex < finalOccupiedCenterlines.length; leftIndex += 1) {\n    for (let rightIndex = leftIndex + 1; rightIndex < finalOccupiedCenterlines.length; rightIndex += 1) {\n      const left = finalOccupiedCenterlines[leftIndex];\n      const right = finalOccupiedCenterlines[rightIndex];\n      if (staticCenterlinesProperlyIntersect(left, right)) staticCenterlineCrossings.push(\`\${left.gate}<->\${right.gate}\`);\n      const clearanceMeters = staticCenterlineDistanceMeters(left, right);\n      if (clearanceMeters < minimumStaticCenterlineClearanceMeters) {\n        minimumStaticCenterlineClearanceMeters = clearanceMeters;\n        minimumStaticCenterlineClearancePair = \`\${left.gate}<->\${right.gate}\`;\n      }\n    }\n  }\n  if (staticCenterlineCrossings.length) {\n    throw new Error(\`Static Terminal 4 final occupied bridge centerlines cross neighboring stands: \${staticCenterlineCrossings.join(\", \")}\`);\n  }\n\n  const finalExactEnvelopes = staticRegisteredPlacements.map((placement, instanceIndex) => ({\n    gate: placement.gate,\n    parts: staticBatches.map((batch) => staticExactInstanceEnvelope(THREE, batch, instanceIndex)),\n  }));\n  const staticExactPartOverlaps = [];\n  let maximumStaticExactPartOverlapDepthMeters = 0;\n  for (let leftIndex = 0; leftIndex < finalExactEnvelopes.length; leftIndex += 1) {\n    for (let rightIndex = leftIndex + 1; rightIndex < finalExactEnvelopes.length; rightIndex += 1) {\n      const leftGate = finalExactEnvelopes[leftIndex];\n      const rightGate = finalExactEnvelopes[rightIndex];\n      for (const leftPart of leftGate.parts) {\n        for (const rightPart of rightGate.parts) {\n          const overlapDepth = staticEnvelopeOverlapDepthXZ(leftPart, rightPart);\n          if (overlapDepth <= ${overlapToleranceMeters}) continue;\n          maximumStaticExactPartOverlapDepthMeters = Math.max(maximumStaticExactPartOverlapDepthMeters, overlapDepth);\n          staticExactPartOverlaps.push(\`\${leftGate.gate}/\${leftPart.part}<->\${rightGate.gate}/\${rightPart.part}=\${overlapDepth.toFixed(3)}m\`);\n        }\n      }\n    }\n  }\n  if (staticExactPartOverlaps.length) {\n    throw new Error(\`Static Terminal 4 exact supplied part envelopes overlap after final registration/telescoping: \${staticExactPartOverlaps.join(\", \")}\`);\n  }`,
  );

  const telemetryAnchor = "  group.userData.uploadedJetwayStaticMaximumTerminalFacingDot = maximumTerminalFacingDot;";
  if (!source.includes(telemetryAnchor)) throw new Error(`${runtimePath}: static telemetry anchor is missing`);
  source = source.replace(
    telemetryAnchor,
    `${telemetryAnchor}\n  group.userData.uploadedJetwayStaticPhysicalPoseAuthority = "${physicalAuthority}";\n  group.userData.uploadedJetwayStaticCenterlineIntersectionAuthority = "${crossingAuthority}";\n  group.userData.uploadedJetwayStaticCenterlineIntersectionCount = staticCenterlineCrossings.length;\n  group.userData.uploadedJetwayStaticMinimumFinalOccupiedCenterlineClearanceMeters = minimumStaticCenterlineClearanceMeters;\n  group.userData.uploadedJetwayStaticMinimumFinalOccupiedCenterlineClearancePair = minimumStaticCenterlineClearancePair;\n  group.userData.uploadedJetwayStaticExactPartOverlapAuthority = "${overlapAuthority}";\n  group.userData.uploadedJetwayStaticExactPartOverlapCount = staticExactPartOverlaps.length;\n  group.userData.uploadedJetwayStaticMaximumExactPartOverlapDepthMeters = maximumStaticExactPartOverlapDepthMeters;`,
  );
}

for (const required of [
  marker,
  "const yaw = targetRegistrationYaw;",
  "escaped its KPHX-authored own-parking centerline",
  "function staticCenterlinesProperlyIntersect",
  "function staticFinalOccupiedCenterline",
  "function staticExactInstanceEnvelope",
  "function staticEnvelopeOverlapDepthXZ",
  "finalExactEnvelopes",
  "staticExactPartOverlaps",
  physicalAuthority,
  crossingAuthority,
  overlapAuthority,
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: final static own-parking correction is missing ${required}`);
}
for (const forbidden of [
  "const yaw = sourceAxisRegistrationYaw;",
  "visible bridge axis escaped decoded KPHX heading",
  "exact bridge envelopes are too close for the supplied 5.49 m-wide model",
  "final occupied exact bridge envelopes are too close for the supplied 5.49 m-wide model",
]) {
  if (source.includes(forbidden)) throw new Error(`${runtimePath}: stale static geometry contract survived: ${forbidden}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Finalized 57 static exact jetways on KPHX-authored own-parking centerlines, then verified the seven final transformed/telescoped supplied-part envelopes with a 5 cm SAT overlap tolerance; maximum Cab width is diagnostic only, not a whole-bridge proxy.");
