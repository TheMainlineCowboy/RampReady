import fs from "node:fs";

const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-service-stair-cab-side-swing-clearance-v1";
const authority = "exact-supplied-tunnel-c-service-stair-rigid-swing-clearance-v1";
const finalVisibleMarker = "a1-final-visible-grounded-door-and-integrated-tunnel-c-v1";
const runtimeSupportMarker = "a1-runtime-tunnel-c-separable-support-meshes-v1";

let source = fs.readFileSync(doorFitPath, "utf8");

if (!source.includes(finalVisibleMarker)) {
  throw new Error(`${doorFitPath}: service-stair clearance must run after final visible door normalization`);
}
if (!source.includes(runtimeSupportMarker)) {
  throw new Error(`${doorFitPath}: service-stair clearance requires final Tunnel-C support normalization`);
}

if (!source.includes(marker)) {
  const helperAnchor = "function restoreUnarticulatedSource(model) {";
  if (!source.includes(helperAnchor)) {
    throw new Error(`${doorFitPath}: service-stair helper insertion anchor is missing`);
  }

  const helper = `// ${marker}\nconst A1_SERVICE_STAIR_CLEARANCE_AUTHORITY = "${authority}";\nconst A1_SERVICE_STAIR_SAFE_CONTACT_PLANE_METERS = 0.05;\nconst A1_SERVICE_STAIR_MAX_SWING_DEGREES = 82;\n\nfunction articulateA1ServiceStairClearOfAircraft(THREE, group, model, targetWorld, cabRelativeYawRadians) {\n  const tunnelCMesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");\n  if (!tunnelCMesh?.isMesh || !tunnelCMesh.geometry?.getAttribute?.("position")) {\n    throw new Error("A1 service-stair clearance cannot resolve exact Tunnel_C_Jetway_0 geometry");\n  }\n\n  // The exact source GLB is shared with the 57 static gates. Clone only A1's\n  // Tunnel-C geometry before articulating a measured triangle subset so no source\n  // asset or static instance can be mutated. Converting the A1 clone to non-indexed\n  // form preserves every supplied triangle, UV and normal while allowing the\n  // authored service-stair triangles to move as one rigid articulated subset.\n  if (!tunnelCMesh.__a1ServiceStairSourceGeometry) {\n    tunnelCMesh.__a1ServiceStairSourceGeometry = tunnelCMesh.geometry.index\n      ? tunnelCMesh.geometry.toNonIndexed()\n      : tunnelCMesh.geometry.clone();\n  }\n  const geometry = tunnelCMesh.__a1ServiceStairSourceGeometry.clone();\n  tunnelCMesh.geometry = geometry;\n  const position = geometry.getAttribute("position");\n  const normal = geometry.getAttribute("normal");\n  if (!position || position.count % 3 !== 0) {\n    throw new Error(`A1 exact Tunnel-C geometry is not triangle-addressable: vertices=${position?.count}`);\n  }\n\n  // These centroid bounds were measured from this exact supplied Tunnel_C_Jetway_0\n  // source primitive in the earlier exact-source decoder. They isolate the diagonal\n  // galvanized service stair/rails without selecting the corrugated tunnel shell or\n  // the dark bogie/lift cluster. No procedural replacement geometry is introduced.\n  const stairVertexIndices = [];\n  const a = new THREE.Vector3();\n  const b = new THREE.Vector3();\n  const c = new THREE.Vector3();\n  for (let index = 0; index < position.count; index += 3) {\n    a.fromBufferAttribute(position, index);\n    b.fromBufferAttribute(position, index + 1);\n    c.fromBufferAttribute(position, index + 2);\n    const centerX = (a.x + b.x + c.x) / 3;\n    const centerY = (a.y + b.y + c.y) / 3;\n    const centerZ = (a.z + b.z + c.z) / 3;\n    const isServiceStair = centerX > 16.4 && centerY < -1.55 && centerZ < 4.8;\n    if (isServiceStair) stairVertexIndices.push(index, index + 1, index + 2);\n  }\n  const stairTriangleCount = stairVertexIndices.length / 3;\n  if (!(stairTriangleCount >= 40 && stairTriangleCount <= 6000)) {\n    throw new Error(`A1 exact service-stair triangle selection is invalid: ${stairTriangleCount}`);\n  }\n\n  model.updateWorldMatrix(true, true);\n  tunnelCMesh.updateWorldMatrix(true, false);\n  group.updateWorldMatrix(true, false);\n  const modelInverse = new THREE.Matrix4().copy(model.matrixWorld).invert();\n  const meshToModel = new THREE.Matrix4().multiplyMatrices(modelInverse, tunnelCMesh.matrixWorld);\n  const modelToMesh = meshToModel.clone().invert();\n  const baseModelPoints = stairVertexIndices.map((vertexIndex) =>\n    new THREE.Vector3().fromBufferAttribute(position, vertexIndex).applyMatrix4(meshToModel));\n\n  let maximumStairY = Number.NEGATIVE_INFINITY;\n  for (const point of baseModelPoints) maximumStairY = Math.max(maximumStairY, point.y);\n  const upperAttachmentBand = baseModelPoints.filter((point) => point.y >= maximumStairY - 0.24);\n  if (upperAttachmentBand.length < 3) {\n    throw new Error(`A1 exact service stair has no measurable upper attachment band: ${upperAttachmentBand.length}`);\n  }\n  const pivot = new THREE.Vector3();\n  for (const point of upperAttachmentBand) pivot.add(point);\n  pivot.multiplyScalar(1 / upperAttachmentBand.length);\n\n  const desiredCabNormalWorld = new THREE.Vector3(1, 0, 0)\n    .transformDirection(group.matrixWorld).setY(0).normalize();\n  const aircraftLongitudinalWorld = new THREE.Vector3(\n    -desiredCabNormalWorld.z, 0, desiredCabNormalWorld.x,\n  ).normalize();\n  const modelToWorld = model.matrixWorld.clone();\n\n  function measureCandidate(angleRadians) {\n    const correction = yawAround(THREE, pivot.x, pivot.z, angleRadians);\n    let maximumFuselagePlanePenetrationMeters = Number.NEGATIVE_INFINITY;\n    let measuredFuselageBandPointCount = 0;\n    const candidate = new THREE.Vector3();\n    const world = new THREE.Vector3();\n    const fromDoor = new THREE.Vector3();\n    for (const basePoint of baseModelPoints) {\n      candidate.copy(basePoint).applyMatrix4(correction);\n      world.copy(candidate).applyMatrix4(modelToWorld);\n      fromDoor.copy(world).sub(targetWorld);\n      const verticalFromDoor = world.y - targetWorld.y;\n      const longitudinalFromDoor = fromDoor.dot(aircraftLongitudinalWorld);\n      if (verticalFromDoor < -1.45 || verticalFromDoor > 1.35 || Math.abs(longitudinalFromDoor) > 5.2) continue;\n      maximumFuselagePlanePenetrationMeters = Math.max(\n        maximumFuselagePlanePenetrationMeters,\n        fromDoor.dot(desiredCabNormalWorld),\n      );\n      measuredFuselageBandPointCount += 1;\n    }\n    if (!measuredFuselageBandPointCount) maximumFuselagePlanePenetrationMeters = Number.NEGATIVE_INFINITY;\n    return { angleRadians, maximumFuselagePlanePenetrationMeters, measuredFuselageBandPointCount };\n  }\n\n  const before = measureCandidate(0);\n  const preferredSign = Math.sign(cabRelativeYawRadians || 1) || 1;\n  let selected = before.maximumFuselagePlanePenetrationMeters <= A1_SERVICE_STAIR_SAFE_CONTACT_PLANE_METERS\n    ? before\n    : null;\n  if (!selected) {\n    for (let degrees = 2; degrees <= A1_SERVICE_STAIR_MAX_SWING_DEGREES && !selected; degrees += 2) {\n      for (const sign of [preferredSign, -preferredSign]) {\n        const candidate = measureCandidate(THREE.MathUtils.degToRad(degrees * sign));\n        if (candidate.maximumFuselagePlanePenetrationMeters <= A1_SERVICE_STAIR_SAFE_CONTACT_PLANE_METERS) {\n          selected = candidate;\n          break;\n        }\n      }\n    }\n  }\n  if (!selected) {\n    throw new Error(\n      `A1 exact service stair cannot clear the CRJ fuselage within ${A1_SERVICE_STAIR_MAX_SWING_DEGREES} degrees: `\n      + `before=${before.maximumFuselagePlanePenetrationMeters} points=${before.measuredFuselageBandPointCount}`,\n    );\n  }\n\n  const correctionModel = yawAround(THREE, pivot.x, pivot.z, selected.angleRadians);\n  const correctionMesh = new THREE.Matrix4()\n    .multiplyMatrices(modelToMesh, correctionModel)\n    .multiply(meshToModel);\n  const normalMatrix = new THREE.Matrix3().getNormalMatrix(correctionMesh);\n  const vertex = new THREE.Vector3();\n  for (const vertexIndex of stairVertexIndices) {\n    vertex.fromBufferAttribute(position, vertexIndex).applyMatrix4(correctionMesh);\n    position.setXYZ(vertexIndex, vertex.x, vertex.y, vertex.z);\n    if (normal) {\n      vertex.fromBufferAttribute(normal, vertexIndex).applyMatrix3(normalMatrix).normalize();\n      normal.setXYZ(vertexIndex, vertex.x, vertex.y, vertex.z);\n    }\n  }\n  position.needsUpdate = true;\n  if (normal) normal.needsUpdate = true;\n  geometry.computeBoundingBox();\n  geometry.computeBoundingSphere();\n  tunnelCMesh.updateMatrixWorld(true);\n\n  const selectedDegrees = THREE.MathUtils.radToDeg(selected.angleRadians);\n  return Object.freeze({\n    authority: A1_SERVICE_STAIR_CLEARANCE_AUTHORITY,\n    stairTriangleCount,\n    upperAttachmentPointCount: upperAttachmentBand.length,\n    swingDegrees: selectedDegrees,\n    beforeFuselagePlanePenetrationMeters: before.maximumFuselagePlanePenetrationMeters,\n    afterFuselagePlanePenetrationMeters: selected.maximumFuselagePlanePenetrationMeters,\n    measuredFuselageBandPointCount: selected.measuredFuselageBandPointCount,\n    pivotModel: pivot.toArray(),\n  });\n}\n\n`;
  source = source.replace(helperAnchor, `${helper}${helperAnchor}`);

  const solveAnchor = `  anchor.rotation.y = correctedYawRadians;\n  anchor.updateMatrixWorld(true);\n  model.updateMatrixWorld(true);\n  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);`;
  if (!source.includes(solveAnchor)) {
    throw new Error(`${doorFitPath}: final parent-yaw service-stair insertion anchor is missing`);
  }
  source = source.replace(
    solveAnchor,
    `${solveAnchor}\n\n  const serviceStairClearance = articulateA1ServiceStairClearOfAircraft(\n    THREE, group, model, targetWorld, cabRelativeYawRadians,\n  );`,
  );

  const resultAnchor = `    contactWidthMeters: cabAssembly.contactWidth,\n    stairGrounding,`;
  if (!source.includes(resultAnchor)) {
    throw new Error(`${doorFitPath}: service-stair result telemetry anchor is missing`);
  }
  source = source.replace(
    resultAnchor,
    `    contactWidthMeters: cabAssembly.contactWidth,\n    serviceStairClearance,\n    stairGrounding,`,
  );

  const telemetryAnchor = `  group.userData.uploadedJetwayA1DoorFitContactWidthMeters = cabAssembly.contactWidth;\n  return result;`;
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${doorFitPath}: service-stair dataset telemetry anchor is missing`);
  }
  source = source.replace(
    telemetryAnchor,
    `  group.userData.uploadedJetwayA1DoorFitContactWidthMeters = cabAssembly.contactWidth;\n  group.userData.uploadedJetwayA1ServiceStairClearanceAuthority = serviceStairClearance.authority;\n  group.userData.uploadedJetwayA1ServiceStairTriangleCount = serviceStairClearance.stairTriangleCount;\n  group.userData.uploadedJetwayA1ServiceStairSwingDegrees = serviceStairClearance.swingDegrees;\n  group.userData.uploadedJetwayA1ServiceStairFuselagePenetrationMeters = serviceStairClearance.afterFuselagePlanePenetrationMeters;\n  return result;`,
  );
}

for (const required of [
  marker,
  authority,
  "Tunnel_C_Jetway_0",
  "centerX > 16.4 && centerY < -1.55 && centerZ < 4.8",
  "A1_SERVICE_STAIR_MAX_SWING_DEGREES = 82",
  "articulateA1ServiceStairClearOfAircraft",
  "serviceStairClearance",
  "uploadedJetwayA1ServiceStairSwingDegrees",
]) {
  if (!source.includes(required)) {
    throw new Error(`${doorFitPath}: final A1 service-stair clearance is missing ${required}`);
  }
}

fs.writeFileSync(doorFitPath, source, "utf8");
console.log(`Prepared ${marker}: A1 clones only its exact Tunnel-C geometry, rigidly swings the measured supplied service-stair triangle subset about its upper attachment until it clears the fixed CRJ fuselage contact plane, and leaves the source GLB, Cab contact, terminal, bogie and 57 static jetways unchanged.`);
