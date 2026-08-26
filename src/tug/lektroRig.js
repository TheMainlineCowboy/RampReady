import { getVehiclePhysicsProfile } from "../config/vehiclePhysicsProfiles.js";

export const LEKTRO_RIG_PROFILE = getVehiclePhysicsProfile("lektro-88");
export const STANDUP_RIG_PROFILE = getVehiclePhysicsProfile("standup-tug");
export const MANAGER_KUBOTA_RIG_PROFILE = getVehiclePhysicsProfile("manager-kubota");

function makeMaterial(THREE, color, roughness = 0.62, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(THREE, width, height, depth, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), makeMaterial(THREE, color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function wheelMesh(THREE, radius, width, name) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 32), makeMaterial(THREE, 0x0c0d0f, 0.88, 0.02));
  mesh.name = name;
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
  }
  visual.add(cradleLift);

  const rollingWheels = [];
  const steeringPivots = [];
  const axleHalfTrack = profile.trackWidth / 2;
  const halfWheelbase = profile.wheelbase / 2;
  const layout = profile.steeringLayout || (profile.steeringMode === "rear" ? "rear-pair" : "front-pair");

  const frontRadius = equipmentId === "lektro-88" ? 0.292 : equipmentId === "manager-kubota" ? 0.31 : 0.22;
  const rearRadius = equipmentId === "lektro-88" ? 0.267 : equipmentId === "manager-kubota" ? 0.31 : 0.22;
  const frontWidth = equipmentId === "lektro-88" ? 0.254 : equipmentId === "manager-kubota" ? 0.20 : 0.16;
  const rearWidth = equipmentId === "lektro-88" ? 0.203 : equipmentId === "manager-kubota" ? 0.20 : 0.18;

  const addAxleWheel = ({ side, z, radius, width, steer, prefix }) => {
    const pivot = new THREE.Group();
    const sideName = side === 0 ? "C" : side < 0 ? "L" : "R";
    pivot.name = `${prefix}${steer ? "Steer" : "Fixed"}_${sideName}`;
    pivot.position.set(side * axleHalfTrack, radius, z);
    const wheel = wheelMesh(THREE, radius, width, `${prefix}Wheel_${sideName}`);
    pivot.add(wheel);
    rollingWheels.push(wheel);
    if (steer) steeringPivots.push(pivot);
    visual.add(pivot);
  };

  if (layout === "rear-single") {
    addAxleWheel({ side: -1, z: halfWheelbase, radius: frontRadius, width: frontWidth, steer: false, prefix: "Front" });
    addAxleWheel({ side: 1, z: halfWheelbase, radius: frontRadius, width: frontWidth, steer: false, prefix: "Front" });
    addAxleWheel({ side: 0, z: -halfWheelbase, radius: rearRadius, width: rearWidth, steer: true, prefix: "Rear" });
  } else if (layout === "front-pair") {
    for (const side of [-1, 1]) {
      addAxleWheel({ side, z: -halfWheelbase, radius: rearRadius, width: rearWidth, steer: false, prefix: "Rear" });
      addAxleWheel({ side, z: halfWheelbase, radius: frontRadius, width: frontWidth, steer: true, prefix: "Front" });
    }
  } else {
    for (const side of [-1, 1]) {
      addAxleWheel({ side, z: halfWheelbase, radius: frontRadius, width: frontWidth, steer: false, prefix: "Front" });
      addAxleWheel({ side, z: -halfWheelbase, radius: rearRadius, width: rearWidth, steer: true, prefix: "Rear" });
    }
  }

  const captureAnchorPosition = profile.captureAnchor || [0, 0.34, profile.cradleOffset];
  const captureAnchor = namedAnchor(THREE, "CaptureAnchor", captureAnchorPosition);
  const operatorEye = namedAnchor(THREE, "OperatorEye", profile.operatorEye);
  const forwardLook = namedAnchor(THREE, "OperatorLook", profile.operatorLook);
  root.add(captureAnchor, operatorEye, forwardLook);

  function setSteering(angle) {
    const physicalWheelAngle = profile.steeringMode === "rear" ? -angle : angle;
    root.userData.authoredSteeringAngle = physicalWheelAngle;
    for (const pivot of steeringPivots) pivot.rotation.y = physicalWheelAngle;
    const authoredPivots = root.userData.authoredSteeringPivots;
    if (Array.isArray(authoredPivots)) {
      for (const pivot of authoredPivots) {
        if (pivot) pivot.rotation.y = physicalWheelAngle;
      }
    }
  }

  function rotateWheels(distance) {
    for (const wheel of rollingWheels) {
      const radius = Number(wheel.geometry?.parameters?.radiusTop) || 0.25;
      wheel.rotation.x += distance / Math.max(0.12, radius);
    }
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
  const layout = rig?.profile?.steeringLayout || (rig?.profile?.steeringMode === "rear" ? "rear-pair" : "front-pair");
  const expectedWheels = layout === "rear-single" ? 3 : 4;
  const expectedSteerPivots = layout === "rear-single" ? 1 : 2;
  if (rig?.rollingWheels?.length !== expectedWheels) failures.push(`expected ${expectedWheels} rolling wheels for ${layout}`);
  if (rig?.steeringPivots?.length !== expectedSteerPivots) failures.push(`expected ${expectedSteerPivots} steering pivots for ${layout}`);
  if (!Number.isFinite(rig?.profile?.cradleOffset) || rig.profile.cradleOffset <= 0) failures.push("invalid cradle offset");
  if (!Number.isFinite(rig?.profile?.wheelbase) || rig.profile.wheelbase <= 0) failures.push("invalid wheelbase");
  if (!["front", "rear"].includes(rig?.profile?.steeringMode)) failures.push("invalid steering mode");
  if (!["front-pair", "rear-pair", "rear-single"].includes(layout)) failures.push("invalid steering layout");
  if (!Number.isFinite(rig?.profile?.freeMaxSpeed) || rig.profile.freeMaxSpeed <= 0) failures.push("invalid free speed");
  return failures;
}
