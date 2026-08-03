const ARTICULATION_AUTHORITY = "exact-source-rotunda-pivot-crj-door-height-v10";
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
  floorY: 4.3,
});
const TARGET = Object.freeze({
  crjDoorThresholdY: 1.8,
  parkedPitchRadians: 0.06,
  tunnelBExtensionShare: 0.32,
  tunnelCExtensionShare: 0.68,
  maximumExtensionMeters: 5,
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

function requireObject(root, name) {
  const object = root?.getObjectByName(name);
  if (!object) throw new Error(`A1 exact-source articulation is missing ${name}`);
  return object;
}

function solveStairPitch(bridgePitch, tunnelCExtension) {
  const [, bottomY, bottomZ] = SOURCE.stairBottomPivot;
  const [, topY, topZ] = SOURCE.stairTop;
  const [, pivotY, pivotZ] = SOURCE.bridgePivot;
  const shiftedTopZ = topZ + tunnelCExtension;
  const shiftedBottomZ = bottomZ + tunnelCExtension;
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
  const tunnelA = requireObject(model, "Tunnel_A");
  const tunnelB = requireObject(model, "Tunnel_B");
  const tunnelC = requireObject(model, "Tunnel_C");
  const cab = requireObject(model, "Cab");
  const rotunda = requireObject(model, "Rotunda");
  const stair = requireObject(model, "Tunnel_C_GalvanizedServiceStair_SourceTriangles");
  const bogie = requireObject(model, "Tunnel_C_DarkBogieLift_SourceTriangles");

  const requestedDeployment = clamp(baseController.getDeployment(), 0, 1);
  baseController.setDeployment(1);

  const attachedExtension = clamp(
    Number(placement.bridgeEnd) - SOURCE.contactZ,
    0,
    TARGET.maximumExtensionMeters,
  );
  const tunnelBExtension = attachedExtension * TARGET.tunnelBExtensionShare;
  const tunnelCExtension = attachedExtension * TARGET.tunnelCExtensionShare;
  tunnelB.position.z += tunnelBExtension;
  tunnelC.position.z += tunnelCExtension;
  cab.position.z += attachedExtension;

  model.updateMatrixWorld(true);

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
  for (const movingAssembly of [tunnelA, tunnelB, tunnelC, cab]) {
    bridgePivot.attach(movingAssembly);
  }

  const contactMarker = new THREE.Object3D();
  contactMarker.name = "UploadedAirportJetway_A1_CabThresholdMarker";
  contactMarker.position.set(0, 0, SOURCE.contactZ + attachedExtension);
  bridgePivot.add(contactMarker);

  const attachedPitch = Math.asin(clamp(
    (SOURCE.floorY - TARGET.crjDoorThresholdY)
      / Math.max(1, SOURCE.contactZ + attachedExtension),
    -0.3,
    0.3,
  ));
  const base = Object.freeze({
    yaw: anchor.rotation.y,
    tunnelB: tunnelB.position.clone(),
    tunnelC: tunnelC.position.clone(),
    cab: cab.position.clone(),
  });

  const articulation = {
    authority: ARTICULATION_AUTHORITY,
    attachedExtension,
    attachedPitch,
    bridgePivot,
    stairPivot,
    groundedBogie,
    contactMarker,
    tunnelCExtension,
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
      stairPivot.rotation.x = solveStairPitch(bridgePitch, tunnelCExtension);
      anchor.updateMatrixWorld(true);
      const contactWorld = contactMarker.getWorldPosition(new THREE.Vector3());

      anchor.userData.articulationAuthority = ARTICULATION_AUTHORITY;
      anchor.userData.bridgePitchRadians = bridgePitch;
      anchor.userData.stairPitchRadians = stairPivot.rotation.x;
      anchor.userData.attachedExtensionMeters = attachedExtension;
      anchor.userData.cabThresholdWorld = contactWorld.toArray();
      anchor.userData.cabThresholdWorldY = contactWorld.y;
      anchor.userData.targetDoorThresholdY = TARGET.crjDoorThresholdY;
      anchor.userData.sourceRotundaFixed = rotunda.parent !== bridgePivot;
      anchor.userData.sourceBogieGrounded = bogie.parent === groundedBogie;
      anchor.userData.sourceStairBottomPivoted = stair.parent === stairPivot;

      group.userData.uploadedJetwayA1ArticulationAuthority = ARTICULATION_AUTHORITY;
      group.userData.uploadedJetwayA1AttachedExtensionMeters = attachedExtension;
      group.userData.uploadedJetwayA1AttachedPitchRadians = attachedPitch;
      group.userData.uploadedJetwayA1CurrentPitchRadians = bridgePitch;
      group.userData.uploadedJetwayA1CabThresholdWorldY = contactWorld.y;
      group.userData.uploadedJetwayA1TargetDoorThresholdY = TARGET.crjDoorThresholdY;
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
