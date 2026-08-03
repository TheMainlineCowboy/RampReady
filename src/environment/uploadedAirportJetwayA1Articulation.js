const ARTICULATION_AUTHORITY = "exact-source-root-hierarchy-rotunda-pivot-crj-door-v11";
const RETRACTION = Object.freeze({
  rotation: 0.052,
  tunnelB: 0.42,
  tunnelC: 0.78,
  cab: 1.18,
  lift: 0.08,
});
const SOURCE = Object.freeze({
  bridgePivot: Object.freeze([0.651626, 4.3, 0]),
  stairBottomPivot: Object.freeze([-1.624111, 0.455146, 15.555789]),
  stairTop: Object.freeze([-1.214334, 7.010758, 21.880923]),
  contactZ: 25.731423,
  contactFloorY: 4.22478,
  proceduralContactClearanceMeters: 1.55,
});
const TARGET = Object.freeze({
  crjDoorThresholdY: 1.8,
  parkedPitchRadians: 0.06,
  tunnelBExtensionShare: 0.25,
  tunnelCExtensionShare: 0.55,
  maximumExtensionMeters: 5,
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

function requireObject(root, name) {
  const object = root?.getObjectByName(name);
  if (!object) throw new Error(`A1 exact-source articulation is missing ${name}`);
  return object;
}

function solveBridgePitch(distance) {
  const [, pivotY] = SOURCE.bridgePivot;
  const localY = SOURCE.contactFloorY - pivotY;
  let low = 0;
  let high = 0.24;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const pitch = (low + high) / 2;
    const thresholdY = pivotY
      + localY * Math.cos(pitch)
      - distance * Math.sin(pitch);
    if (thresholdY > TARGET.crjDoorThresholdY) low = pitch;
    else high = pitch;
  }
  return (low + high) / 2;
}

function solveStairPitch(bridgePitch, tunnelCTravel) {
  const [, bottomY, bottomZ] = SOURCE.stairBottomPivot;
  const [, topY, topZ] = SOURCE.stairTop;
  const [, pivotY, pivotZ] = SOURCE.bridgePivot;
  const shiftedTopZ = topZ + tunnelCTravel;
  const shiftedBottomZ = bottomZ + tunnelCTravel;
  const desiredTopY = pivotY
    + (topY - pivotY) * Math.cos(bridgePitch)
    - (shiftedTopZ - pivotZ) * Math.sin(bridgePitch);
  const deltaY = topY - bottomY;
  const deltaZ = shiftedTopZ - shiftedBottomZ;
  const radius = Math.hypot(deltaY, deltaZ);
  const phase = Math.atan2(deltaZ, deltaY);
  return Math.acos(clamp((desiredTopY - bottomY) / radius, -1, 1)) - phase;
}

export function installUploadedAirportJetwayA1Articulation(
  THREE,
  group,
  fleet,
  placements,
  baseController,
) {
  if (!group?.isGroup || !fleet?.isGroup || !baseController) {
    throw new Error("A1 exact-source articulation requires the source group, uploaded fleet and base controller");
  }
  const placement = placements.find((entry) => entry.gate === "A1");
  if (!placement) throw new Error("A1 exact-source articulation could not find the decoded A1 placement");

  const anchor = requireObject(fleet, "UploadedAirportJetway_A1");
  const model = requireObject(fleet, "UploadedAirportJetwayModel_A1");
  const rootNode = requireObject(model, "RootNode");
  const tunnelB = requireObject(rootNode, "Tunnel_B");
  const tunnelC = requireObject(rootNode, "Tunnel_C");
  const cab = requireObject(rootNode, "Cab");
  const rotunda = requireObject(rootNode, "Rotunda");
  const stair = requireObject(rootNode, "Tunnel_C_GalvanizedServiceStair_SourceTriangles");
  const bogie = requireObject(rootNode, "Tunnel_C_DarkBogieLift_SourceTriangles");

  const requestedDeployment = clamp(baseController.getDeployment(), 0, 1);
  baseController.setDeployment(1);

  // The decoded procedural bridgeEnd intentionally stops 1.55 m before its
  // generated bellows. The supplied FBX includes its own complete cab, so its
  // true door target is the full decoded anchor-to-door distance.
  const targetDistance = Number(placement.bridgeEnd)
    + SOURCE.proceduralContactClearanceMeters;
  const attachedExtension = clamp(
    targetDistance - SOURCE.contactZ,
    0,
    TARGET.maximumExtensionMeters,
  );
  const tunnelBExtension = attachedExtension * TARGET.tunnelBExtensionShare;
  const tunnelCExtension = attachedExtension * TARGET.tunnelCExtensionShare;
  tunnelB.position.z += tunnelBExtension;
  tunnelC.position.z += tunnelCExtension;
  cab.position.z += attachedExtension;

  model.updateMatrixWorld(true);

  // Keep the exact source rotunda upright and fixed at the terminal. Only the
  // authored RootNode corridor hierarchy pitches; Tunnel A/B/C and Cab remain
  // siblings under their original FBX parent and are never independently
  // reparented or rotated.
  const fixedRotunda = new THREE.Group();
  fixedRotunda.name = "UploadedAirportJetway_A1_FixedSourceRotunda";
  model.add(fixedRotunda);
  model.updateMatrixWorld(true);
  fixedRotunda.attach(rotunda);

  const groundedBogie = new THREE.Group();
  groundedBogie.name = "UploadedAirportJetway_A1_GroundedSourceBogie";
  model.add(groundedBogie);
  model.updateMatrixWorld(true);
  groundedBogie.attach(bogie);

  const stairPivot = new THREE.Group();
  stairPivot.name = "UploadedAirportJetway_A1_SourceStairBottomPivot";
  stairPivot.position.fromArray(SOURCE.stairBottomPivot);
  stairPivot.position.z += tunnelCExtension;
  model.add(stairPivot);
  model.updateMatrixWorld(true);
  stairPivot.attach(stair);

  const bridgePivot = new THREE.Group();
  bridgePivot.name = "UploadedAirportJetway_A1_RotundaBridgePitchPivot";
  bridgePivot.position.fromArray(SOURCE.bridgePivot);
  model.add(bridgePivot);
  model.updateMatrixWorld(true);
  bridgePivot.attach(rootNode);

  const contactMarker = new THREE.Object3D();
  contactMarker.name = "UploadedAirportJetway_A1_CabThresholdMarker";
  contactMarker.position.set(
    0,
    SOURCE.contactFloorY - SOURCE.bridgePivot[1],
    targetDistance,
  );
  bridgePivot.add(contactMarker);

  const attachedPitch = solveBridgePitch(targetDistance);
  const base = Object.freeze({
    yaw: anchor.rotation.y,
    tunnelB: tunnelB.position.clone(),
    tunnelC: tunnelC.position.clone(),
    cab: cab.position.clone(),
    groundedBogie: groundedBogie.position.clone(),
    stairPivot: stairPivot.position.clone(),
  });

  const articulation = {
    authority: ARTICULATION_AUTHORITY,
    targetDistance,
    attachedExtension,
    attachedPitch,
    bridgePivot,
    fixedRotunda,
    stairPivot,
    groundedBogie,
    contactMarker,
    apply(value) {
      const deployment = clamp(value, 0, 1);
      const retract = 1 - deployment;
      anchor.rotation.y = base.yaw - retract * RETRACTION.rotation;
      tunnelB.position.z = base.tunnelB.z - retract * RETRACTION.tunnelB;
      tunnelC.position.z = base.tunnelC.z - retract * RETRACTION.tunnelC;
      cab.position.z = base.cab.z - retract * RETRACTION.cab;
      cab.position.y = base.cab.y + retract * RETRACTION.lift;

      const bridgePitch = TARGET.parkedPitchRadians
        + deployment * (attachedPitch - TARGET.parkedPitchRadians);
      bridgePivot.rotation.x = bridgePitch;
      const tunnelCTravel = tunnelCExtension - retract * RETRACTION.tunnelC;
      groundedBogie.position.copy(base.groundedBogie);
      groundedBogie.position.z -= retract * RETRACTION.tunnelC;
      stairPivot.position.copy(base.stairPivot);
      stairPivot.position.z -= retract * RETRACTION.tunnelC;
      stairPivot.rotation.x = solveStairPitch(bridgePitch, tunnelCTravel);

      anchor.updateMatrixWorld(true);
      const contactWorld = contactMarker.getWorldPosition(new THREE.Vector3());

      anchor.userData.articulationAuthority = ARTICULATION_AUTHORITY;
      anchor.userData.bridgePitchRadians = bridgePitch;
      anchor.userData.stairPitchRadians = stairPivot.rotation.x;
      anchor.userData.targetDistanceMeters = targetDistance;
      anchor.userData.attachedExtensionMeters = attachedExtension;
      anchor.userData.cabThresholdWorld = contactWorld.toArray();
      anchor.userData.cabThresholdWorldY = contactWorld.y;
      anchor.userData.targetDoorThresholdY = TARGET.crjDoorThresholdY;
      anchor.userData.sourceRootHierarchyPreserved = rootNode.getObjectByName("Tunnel_A")
        && rootNode.getObjectByName("Tunnel_B")
        && rootNode.getObjectByName("Tunnel_C")
        && rootNode.getObjectByName("Cab");
      anchor.userData.sourceRotundaFixed = rotunda.parent === fixedRotunda;
      anchor.userData.sourceBogieGrounded = bogie.parent === groundedBogie;
      anchor.userData.sourceStairBottomPivoted = stair.parent === stairPivot;

      group.userData.uploadedJetwayA1ArticulationAuthority = ARTICULATION_AUTHORITY;
      group.userData.uploadedJetwayA1TargetDistanceMeters = targetDistance;
      group.userData.uploadedJetwayA1AttachedExtensionMeters = attachedExtension;
      group.userData.uploadedJetwayA1AttachedPitchRadians = attachedPitch;
      group.userData.uploadedJetwayA1CurrentPitchRadians = bridgePitch;
      group.userData.uploadedJetwayA1CabThresholdWorldY = contactWorld.y;
      group.userData.uploadedJetwayA1TargetDoorThresholdY = TARGET.crjDoorThresholdY;
      group.userData.uploadedJetwayA1SourceRootHierarchyPreserved = Boolean(anchor.userData.sourceRootHierarchyPreserved);
      group.userData.uploadedJetwayA1SourceRotundaFixed = anchor.userData.sourceRotundaFixed;
      group.userData.uploadedJetwayA1SourceBogieGrounded = anchor.userData.sourceBogieGrounded;
      group.userData.uploadedJetwayA1SourceStairBottomPivoted = anchor.userData.sourceStairBottomPivoted;
      return {
        deployment,
        bridgePitch,
        stairPitch: stairPivot.rotation.x,
        contactWorld: contactWorld.toArray(),
      };
    },
  };

  model.userData.a1ArticulationAuthority = ARTICULATION_AUTHORITY;
  model.userData.a1SourceMeshGeometryPreserved = true;
  model.userData.a1SourceRootHierarchyPreserved = true;
  model.userData.a1TargetDistanceMeters = targetDistance;
  model.userData.a1AttachedExtensionMeters = attachedExtension;
  model.userData.a1AttachedPitchRadians = attachedPitch;
  model.userData.a1TargetDoorThresholdY = TARGET.crjDoorThresholdY;

  baseController.setDeployment(requestedDeployment);
  articulation.apply(requestedDeployment);
  return articulation;
}

export {
  ARTICULATION_AUTHORITY as UPLOADED_AIRPORT_JETWAY_A1_ARTICULATION_AUTHORITY,
};
