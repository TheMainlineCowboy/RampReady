import { getVehiclePhysicsProfile } from "../config/vehiclePhysicsProfiles.js";

export const LEKTRO_RIG_PROFILE = getVehiclePhysicsProfile("lektro-88");
export const STANDUP_RIG_PROFILE = getVehiclePhysicsProfile("standup-tug");
export const MANAGER_KUBOTA_RIG_PROFILE = getVehiclePhysicsProfile("manager-kubota");

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
  return getVehiclePhysicsProfile(equipmentId);
}

export function createProceduralLektroRig(THREE, equipmentId = "lektro-88") {
  const profile = getTugRigProfile(equipmentId);
  const root = new THREE.Group();
  root.name = equipmentId === "standup-tug"
    ? "RampReady_StandupPhysicsRig"
    : equipmentId === "manager-kubota"
      ? "RampReady_ManagerKubotaPhysicsRig"
      : "RampReady_LektroRig";

  const visual = new THREE.Group();
  visual.name = "VehicleFallbackVisual";
  root.add(visual);

  const [bodyWidth, bodyHeight, bodyLength] = profile.bodyBounds;
  const fallbackColor = equipmentId === "manager-kubota" ? 0xe56b17 : 0xb42324;
  visual.add(box(THREE, bodyWidth, Math.min(0.48, bodyHeight * 0.34), bodyLength, fallbackColor, 0, 0.46, 0));
  visual.add(box(THREE, bodyWidth * 0.88, 0.10, bodyLength * 0.86, 0x20242b, 0, 0.73, -0.06));

  const cradleLift = new THREE.Group();
  cradleLift.name = "CradleLift";
  if (profile.role === "towbarless-pushback") {
    const cradleWidth = Math.min(bodyWidth * 0.82, 1.8);
    cradleLift.add(box(THREE, cradleWidth, 0.1, 0.80, 0x111318, 0, 0.22, profile.cradleOffset - 0.48));
    cradleLift.add(box(THREE, cradleWidth * 0.94, 0.12, 0.72, 0x111318, 0, 0.34, profile.cradleOffset));
    for (const side of [-1, 1]) {
      cradleLift.add(box(THREE, 0.14, 0.50, 0.70, 0xffcc00, side * cradleWidth * 0.35, 0.51, profile.cradleOffset));
    }
  }
  visual.add(cradleLift);

  const rollingWheels = [];
  const steeringPivots = [];
  const axleHalfTrack = profile.trackWidth / 2;
  const halfWheelbase = profile.wheelbase / 2;
  const wheelRadius = equipmentId === "manager-kubota" ? 0.31 : equipmentId === "standup-tug" ? 0.22 : 0.48;
  const wheelWidth = equipmentId === "manager-kubota" ? 0.20 : equipmentId === "standup-tug" ? 0.16 : 0.36;

  for (const side of [-1, 1]) {
    const rearPivot = new THREE.Group();
    rearPivot.name = side < 0 ? "RearSteer_L" : "RearSteer_R";
    rearPivot.position.set(side * axleHalfTrack, wheelRadius, -halfWheelbase);
    const rear = cylinder(THREE, wheelRadius, wheelWidth, 0x0c0d0f, 0, 0, 0);
    rear.name = side < 0 ? "RearWheel_L" : "RearWheel_R";
    rearPivot.add(rear);
    rollingWheels.push(rear);
    visual.add(rearPivot);

    const frontPivot = new THREE.Group();
    frontPivot.name = side < 0 ? "FrontSteer_L" : "FrontSteer_R";
    frontPivot.position.set(side * axleHalfTrack, wheelRadius, halfWheelbase);
    const front = cylinder(THREE, wheelRadius, wheelWidth, 0x0c0d0f, 0, 0, 0);
    front.name = side < 0 ? "FrontWheel_L" : "FrontWheel_R";
    frontPivot.add(front);
    rollingWheels.push(front);
    visual.add(frontPivot);

    steeringPivots.push(profile.steeringMode === "rear" ? rearPivot : frontPivot);
  }

  const captureAnchorPosition = profile.captureAnchor || [0, 0.34, profile.cradleOffset];
  const captureAnchor = namedAnchor(THREE, "CaptureAnchor", captureAnchorPosition);
  const operatorEye = namedAnchor(THREE, "OperatorEye", profile.operatorEye);
  const forwardLook = namedAnchor(THREE, "OperatorLook", profile.operatorLook);
  root.add(captureAnchor, operatorEye, forwardLook);

  function setSteering(angle) {
    const physicalWheelAngle = profile.steeringMode === "rear" ? -angle : angle;
    for (const pivot of steeringPivots) pivot.rotation.y = physicalWheelAngle;
  }

  function rotateWheels(distance) {
    const radians = distance / Math.max(0.12, wheelRadius);
    for (const wheel of rollingWheels) wheel.rotation.x += radians;
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
  if (!Number.isFinite(rig?.profile?.freeMaxSpeed) || rig.profile.freeMaxSpeed <= 0) failures.push("invalid free speed");
  return failures;
}
