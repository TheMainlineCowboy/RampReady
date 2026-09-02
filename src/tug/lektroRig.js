export const LEKTRO_RIG_PROFILE = Object.freeze({
  id: "lektro-ap88-r4",
  // BetterPushback AP88 info.cfg: front_z 0.77, rear_z -1.575.
  wheelbase: 2.345,
  trackWidth: 1.89,
  cradleOffset: 2.69,
  operatorEye: Object.freeze([0.44, 1.40, -1.90]),
  operatorLook: Object.freeze([0.44, 1.12, 4.40]),
  captureAnchor: Object.freeze([0, 0.08, 2.69]),
  liftTravel: 0.13,
  bodyBounds: Object.freeze([2.1821, 1.1032, 5.368]),
  steeringMode: "rear",
  steerWheelRadius: 0.265,
  driveWheelRadius: 0.304,
  maxSteer: (60 * Math.PI) / 180,
});

export const STANDUP_RIG_PROFILE = Object.freeze({
  id: "standup-authored-reference",
  wheelbase: 2.7,
  trackWidth: 1.32,
  cradleOffset: 3.45,
  // Operator stands on the right-hand platform behind the wheel, facing the capture end.
  operatorEye: Object.freeze([0.58, 1.64, -1.28]),
  operatorLook: Object.freeze([0.52, 1.15, 3.2]),
  captureAnchor: Object.freeze([0, 0.34, 3.45]),
  liftTravel: 0.24,
  bodyBounds: Object.freeze([1.4161, 1.6721, 4.5855]),
  steeringMode: "rear",
});

function makeMaterial(THREE, color, roughness = 0.62, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(THREE, width, height, depth, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    makeMaterial(THREE, color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(THREE, radius, depth, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, 32),
    makeMaterial(THREE, color, 0.78, 0.04),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.z = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function namedAnchor(THREE, name, position) {
  const anchor = new THREE.Object3D();
  anchor.name = name;
  anchor.position.fromArray(position);
  return anchor;
}

export function getTugRigProfile(equipmentId) {
  return equipmentId === "standup-tug" ? STANDUP_RIG_PROFILE : LEKTRO_RIG_PROFILE;
}

export function createProceduralLektroRig(THREE, equipmentId = "lektro-88") {
  const profile = getTugRigProfile(equipmentId);
  const root = new THREE.Group();
  root.name = equipmentId === "standup-tug" ? "RampReady_StandupPhysicsRig" : "RampReady_LektroRig";

  const visual = new THREE.Group();
  visual.name = "TugVisual";
  root.add(visual);

  visual.add(box(THREE, 2.35, 0.42, 5.5, 0xb42324, 0, 0.55, -0.15));
  visual.add(box(THREE, 2.08, 0.11, 4.95, 0x20242b, 0, 0.82, -0.2));
  visual.add(box(THREE, 1.42, 0.32, 1.22, 0xb42324, 0, 0.92, -1.43));

  const cradleLift = new THREE.Group();
  cradleLift.name = "CradleLift";
  cradleLift.add(box(THREE, 1.8, 0.1, 0.95, 0x111318, 0, 0.22, Math.max(2.0, profile.cradleOffset - 0.7)));
  cradleLift.add(box(THREE, 1.7, 0.12, 0.9, 0x111318, 0, 0.34, profile.cradleOffset));
  for (const side of [-1, 1]) {
    cradleLift.add(box(THREE, 0.16, 0.56, 0.85, 0xffcc00, side * 0.62, 0.55, profile.cradleOffset));
  }
  visual.add(cradleLift);

  const rollingWheels = [];
  const rollingWheelRadii = [];
  const steeringPivots = [];
  for (const side of [-1, 1]) {
    const rearPivot = new THREE.Group();
    rearPivot.name = side < 0 ? "RearSteer_L" : "RearSteer_R";
    const lektroRearZ = equipmentId === "standup-tug" ? -1.65 : -0.77;
    const lektroRearRadius = equipmentId === "standup-tug" ? 0.55 : profile.steerWheelRadius;
    rearPivot.position.set(side * (profile.trackWidth / 2), lektroRearRadius, lektroRearZ);
    const rear = cylinder(THREE, lektroRearRadius, equipmentId === "standup-tug" ? 0.42 : 0.34, 0x0c0d0f, 0, 0, 0);
    rear.name = side < 0 ? "RearWheel_L" : "RearWheel_R";
    rearPivot.add(rear);
    rollingWheels.push(rear);
    rollingWheelRadii.push(lektroRearRadius);
    visual.add(rearPivot);

    const frontPivot = new THREE.Group();
    frontPivot.name = side < 0 ? "FrontSteer_L" : "FrontSteer_R";
    const lektroFrontZ = equipmentId === "standup-tug" ? 1.95 : 1.575;
    const lektroFrontRadius = equipmentId === "standup-tug" ? 0.5 : profile.driveWheelRadius;
    frontPivot.position.set(side * (profile.trackWidth / 2), lektroFrontRadius, lektroFrontZ);
    const front = cylinder(THREE, lektroFrontRadius, equipmentId === "standup-tug" ? 0.38 : 0.38, 0x0c0d0f, 0, 0, 0);
    front.name = side < 0 ? "FrontWheel_L" : "FrontWheel_R";
    frontPivot.add(front);
    rollingWheels.push(front);
    rollingWheelRadii.push(lektroFrontRadius);
    visual.add(frontPivot);

    steeringPivots.push(profile.steeringMode === "rear" ? rearPivot : frontPivot);
  }

  const captureAnchor = namedAnchor(THREE, "CaptureAnchor", profile.captureAnchor);
  const operatorEye = namedAnchor(THREE, "OperatorEye", profile.operatorEye);
  const forwardLook = namedAnchor(THREE, "OperatorLook", profile.operatorLook);
  root.add(captureAnchor, operatorEye, forwardLook);

  function setSteering(angle) {
    // A left steering-wheel command turns a rear-steer axle the opposite physical direction.
    const physicalWheelAngle = profile.steeringMode === "rear" ? -angle : angle;
    for (const pivot of steeringPivots) pivot.rotation.y = physicalWheelAngle;
  }

  function rotateWheels(distance) {
    rollingWheels.forEach((wheel, index) => {
      const radius = rollingWheelRadii[index] || 0.5;
      wheel.rotation.x += distance / radius;
    });
  }

  function setLiftProgress(progress) {
    const normalized = Math.max(0, Math.min(1, progress));
    cradleLift.position.y = normalized * profile.liftTravel;
  }

  function getWorldAnchor(anchor, target = new THREE.Vector3()) {
    root.updateMatrixWorld(true);
    return anchor.getWorldPosition(target);
  }

  return {
    root,
    visual,
    cradleLift,
    captureAnchor,
    operatorEye,
    forwardLook,
    rollingWheels,
    steeringPivots,
    profile,
    setSteering,
    rotateWheels,
    setLiftProgress,
    getCaptureWorld(target) { return getWorldAnchor(captureAnchor, target); },
    getOperatorEyeWorld(target) { return getWorldAnchor(operatorEye, target); },
    getOperatorLookWorld(target) { return getWorldAnchor(forwardLook, target); },
  };
}

export function validateTugRig(rig) {
  const failures = [];
  if (!rig?.root) failures.push("missing root");
  if (!rig?.captureAnchor) failures.push("missing capture anchor");
  if (!rig?.operatorEye) failures.push("missing operator eye anchor");
  if (!rig?.cradleLift) failures.push("missing cradle lift group");
  if (rig?.rollingWheels?.length !== 4) failures.push("expected four rolling wheels");
  if (rig?.steeringPivots?.length !== 2) failures.push("expected two steering pivots");
  if (!Number.isFinite(rig?.profile?.cradleOffset) || rig.profile.cradleOffset <= 0) failures.push("invalid cradle offset");
  if (!Number.isFinite(rig?.profile?.wheelbase) || rig.profile.wheelbase <= 0) failures.push("invalid wheelbase");
  if (!["front", "rear"].includes(rig?.profile?.steeringMode)) failures.push("invalid steering mode");
  return failures;
}
