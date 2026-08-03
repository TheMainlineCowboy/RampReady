import {
  computeUploadedJetwayArticulation,
  UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
} from "./uploadedAirportJetwayArticulationV10.js";

const PART_NAMES = Object.freeze(["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]);
const STAIR_NAME = "Tunnel_C_GalvanizedServiceStair_SourceTriangles";
const BOGIE_NAME = "Tunnel_C_DarkBogieLift_SourceTriangles";

export function findUploadedJetwaySourcePart(model, name) {
  const root = model?.getObjectByName?.("RootNode");
  return root?.children?.find((entry) => entry.name === name) || null;
}

function sourcePartName(entry) {
  let current = entry;
  while (current?.parent && current.parent.name !== "RootNode") current = current.parent;
  return current?.parent?.name === "RootNode" && PART_NAMES.includes(current.name) ? current.name : null;
}

export function measureUploadedJetwaySourcePose(THREE, prototype) {
  prototype.updateMatrixWorld(true);
  const rotunda = findUploadedJetwaySourcePart(prototype, "Rotunda");
  const cab = findUploadedJetwaySourcePart(prototype, "Cab");
  const stair = prototype.getObjectByName(STAIR_NAME);
  const bogie = prototype.getObjectByName(BOGIE_NAME);
  if (!rotunda || !cab || !stair || !bogie) throw new Error("Supplied jetway source pose is incomplete");
  const rotundaBox = new THREE.Box3().setFromObject(rotunda);
  const cabBox = new THREE.Box3().setFromObject(cab);
  const rotundaCenter = rotundaBox.getCenter(new THREE.Vector3());
  const cabCenter = cabBox.getCenter(new THREE.Vector3());
  const cabPivot = cab.getWorldPosition(new THREE.Vector3());
  const cabContact = new THREE.Vector3(cabCenter.x, cabCenter.y, cabBox.max.z);
  const cabContactLever = cabContact.clone().sub(cabPivot);
  const cabContactLocal = cab.worldToLocal(cabContact.clone());
  const cabWorldQuaternion = cab.getWorldQuaternion(new THREE.Quaternion());
  const cabOpeningNormalWorld = new THREE.Vector3(0, 0, 1);
  const cabOpeningNormalLocal = cabOpeningNormalWorld.clone()
    .applyQuaternion(cabWorldQuaternion.clone().invert())
    .normalize();
  const sourceContactDistance = cabBox.max.z - rotundaCenter.z;
  if (!(sourceContactDistance > 10 && sourceContactDistance < 40)) {
    throw new Error(`Supplied jetway source reach is invalid: ${sourceContactDistance}`);
  }
  return {
    sourceContactDistance,
    cabContactLocal,
    cabOpeningNormalLocal,
    articulationSource: {
      sourceContactDistance,
      cabPivot: { x: cabPivot.x, y: cabPivot.y, z: cabPivot.z },
      cabContact: { x: cabContact.x, y: cabContact.y, z: cabContact.z },
      cabContactLever: { x: cabContactLever.x, y: cabContactLever.y, z: cabContactLever.z },
      cabOpeningYaw: 0,
    },
  };
}

function translateByWorldDelta(THREE, object, worldDelta) {
  if (!object?.parent) return;
  object.parent.updateMatrixWorld(true);
  const origin = object.parent.worldToLocal(new THREE.Vector3());
  const target = object.parent.worldToLocal(worldDelta.clone());
  object.position.add(target.sub(origin));
}

export function applyUploadedJetwayFull3DPose(THREE, model, articulation) {
  for (const [name, offset] of Object.entries(articulation.partOffsets)) {
    const part = findUploadedJetwaySourcePart(model, name);
    if (!part) throw new Error(`Supplied jetway articulation is missing ${name}`);
    part.position.z += offset.z;
    part.position.y += offset.y;
    part.userData.uploadedJetwayLongitudinalOffsetMeters = offset.z;
    part.userData.uploadedJetwayVerticalOffsetMeters = offset.y;
  }
  const cab = findUploadedJetwaySourcePart(model, "Cab");
  cab.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    articulation.cabYawOffset,
  ));
  model.updateMatrixWorld(true);
  const groundCompensation = new THREE.Vector3(0, -(articulation.partOffsets.Tunnel_C?.y || 0), 0);
  translateByWorldDelta(THREE, model.getObjectByName(STAIR_NAME), groundCompensation);
  translateByWorldDelta(THREE, model.getObjectByName(BOGIE_NAME), groundCompensation);
  model.updateMatrixWorld(true);
  model.userData.uploadedJetwayArticulation = articulation;
}

export function measureUploadedJetwayFull3DPose(THREE, anchor, model, sourcePose, placement, articulation) {
  anchor.updateMatrixWorld(true);
  const cab = findUploadedJetwaySourcePart(model, "Cab");
  const stair = model.getObjectByName(STAIR_NAME);
  const bogie = model.getObjectByName(BOGIE_NAME);
  if (!cab || !stair || !bogie) throw new Error(`Supplied jetway ${placement.gate} is missing aircraft-end geometry`);
  const contact = cab.localToWorld(sourcePose.cabContactLocal.clone());
  const openingNormal = sourcePose.cabOpeningNormalLocal.clone().transformDirection(cab.matrixWorld).normalize();
  const target = new THREE.Vector3(
    placement.x + articulation.targetContact.x,
    articulation.targetContact.y,
    placement.z + articulation.targetContact.z,
  );
  const desiredNormal = new THREE.Vector3(
    Math.sin(articulation.desiredOpeningYaw), 0, Math.cos(articulation.desiredOpeningYaw),
  ).normalize();
  const normalErrorRadians = Math.acos(Math.max(-1, Math.min(1, openingNormal.dot(desiredNormal))));
  const direction = new THREE.Vector3(Math.sin(articulation.anchorYaw), 0, Math.cos(articulation.anchorYaw));
  const anchorPosition = anchor.getWorldPosition(new THREE.Vector3());
  const partCenters = Object.fromEntries(PART_NAMES.map((name) => {
    const center = new THREE.Box3().setFromObject(findUploadedJetwaySourcePart(model, name)).getCenter(new THREE.Vector3());
    return [name, center.sub(anchorPosition).dot(direction)];
  }));
  return {
    contact,
    actualDoorGap: contact.distanceTo(target),
    cabHeightError: Math.abs(contact.y - target.y),
    cabNormalErrorDegrees: THREE.MathUtils.radToDeg(normalErrorRadians),
    stairGroundClearance: new THREE.Box3().setFromObject(stair).min.y,
    bogieGroundClearance: new THREE.Box3().setFromObject(bogie).min.y,
    partCenters,
    partOrderValid: partCenters.Rotunda < partCenters.Tunnel_A
      && partCenters.Tunnel_A < partCenters.Tunnel_B
      && partCenters.Tunnel_B < partCenters.Tunnel_C
      && partCenters.Tunnel_C < partCenters.Cab,
  };
}

function collectMeshes(model) {
  const meshes = [];
  model.traverse((entry) => {
    if (!entry.isMesh) return;
    if (!sourcePartName(entry)) throw new Error(`Supplied jetway mesh ${entry.name || "unnamed"} lost its authored part`);
    meshes.push(entry);
  });
  return meshes;
}

export function buildUploadedJetwayStaticFull3D(THREE, prototype, placements, sourcePose) {
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  const prototypeMeshes = collectMeshes(prototype);
  const matrices = prototypeMeshes.map(() => []);
  let maximumContactError = 0;
  let maximumNormalErrorDegrees = 0;
  let maximumHeightError = 0;
  let minimumStairGroundClearance = Infinity;
  let maximumStairGroundClearance = -Infinity;
  let minimumBogieGroundClearance = Infinity;
  let maximumBogieGroundClearance = -Infinity;
  let allPartOrdersValid = true;

  for (const placement of staticPlacements) {
    const articulation = computeUploadedJetwayArticulation(placement, sourcePose.articulationSource);
    const anchor = new THREE.Group();
    anchor.position.set(placement.x, 0, placement.z);
    anchor.rotation.y = articulation.anchorYaw;
    const model = prototype.clone(true);
    applyUploadedJetwayFull3DPose(THREE, model, articulation);
    anchor.add(model);
    anchor.updateMatrixWorld(true);
    const result = measureUploadedJetwayFull3DPose(THREE, anchor, model, sourcePose, placement, articulation);
    maximumContactError = Math.max(maximumContactError, result.actualDoorGap);
    maximumNormalErrorDegrees = Math.max(maximumNormalErrorDegrees, result.cabNormalErrorDegrees);
    maximumHeightError = Math.max(maximumHeightError, result.cabHeightError);
    minimumStairGroundClearance = Math.min(minimumStairGroundClearance, result.stairGroundClearance);
    maximumStairGroundClearance = Math.max(maximumStairGroundClearance, result.stairGroundClearance);
    minimumBogieGroundClearance = Math.min(minimumBogieGroundClearance, result.bogieGroundClearance);
    maximumBogieGroundClearance = Math.max(maximumBogieGroundClearance, result.bogieGroundClearance);
    allPartOrdersValid = allPartOrdersValid && result.partOrderValid;
    const articulatedMeshes = collectMeshes(model);
    if (articulatedMeshes.length !== prototypeMeshes.length) throw new Error(`Supplied jetway ${placement.gate} changed primitive count`);
    articulatedMeshes.forEach((mesh, index) => matrices[index].push(mesh.matrixWorld.clone()));
  }

  const batches = new THREE.Group();
  batches.name = "UploadedAirportJetwayStaticInstancedBatches";
  prototypeMeshes.forEach((definition, primitiveIndex) => {
    const batch = new THREE.InstancedMesh(definition.geometry, definition.material, staticPlacements.length);
    batch.name = `UploadedAirportJetwayStatic_${primitiveIndex}_${definition.name || "Primitive"}`;
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    batch.castShadow = false;
    batch.receiveShadow = true;
    matrices[primitiveIndex].forEach((matrix, instanceIndex) => batch.setMatrixAt(instanceIndex, matrix));
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    batches.add(batch);
  });

  return {
    batches,
    staticGateCount: staticPlacements.length,
    primitiveBatchCount: prototypeMeshes.length,
    articulatedGateCount: staticPlacements.length,
    maximumContactError,
    maximumNormalErrorDegrees,
    maximumHeightError,
    minimumStairGroundClearance,
    maximumStairGroundClearance,
    minimumBogieGroundClearance,
    maximumBogieGroundClearance,
    allPartOrdersValid,
    articulationAuthority: UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
  };
}
