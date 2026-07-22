export const LEKTRO_RIG_PROFILE = Object.freeze({
  id: "lektro-standup-reference",
  wheelbase: 3.6,
  trackWidth: 2.28,
  cradleOffset: 3.45,
  operatorEye: Object.freeze([-0.45, 1.35, -2.15]),
  captureAnchor: Object.freeze([0, 0.34, 3.45]),
  liftTravel: 0.24,
  bodyBounds: Object.freeze([2.35, 1.45, 5.5]),
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

export function createProceduralLektroRig(THREE) {
  const root = new THREE.Group();
  root.name = "RampReady_LektroRig";

  const visual = new THREE.Group();
  visual.name = "TugVisual";
  root.add(visual);

  visual.add(box(THREE, 2.35, 0.42, 5.5, 0xb42324, 0, 0.55, -0.15));
  visual.add(box(THREE, 2.08, 0.11, 4.95, 0x20242b, 0, 0.82, -0.2));
  visual.add(box(THREE, 1.42, 0.32, 1.22, 0xb42324, 0, 0.92, -1.43));

  const cradleLift = new THREE.Group();
  cradleLift.name = "CradleLift";
  cradleLift.add(box(THREE, 1.8, 0.1, 0.95, 0x111318, 0, 0.22, 2.75));
  cradleLift.add(box(THREE, 1.7, 0.12, 0.9, 0x111318, 0, 0.34, LEKTRO_RIG_PROFILE.cradleOffset));
  for (const side of [-1, 1]) {
    cradleLift.add(box(THREE, 0.16, 0.56, 0.85, 0xffcc00, side * 0.62, 0.55, LEKTRO_RIG_PROFILE.cradleOffset));
  }
  visual.add(cradleLift);

  const rollingWheels = [];
  const steeringPivots = [];
  for (const side of [-1, 1]) {
    const rear = cylinder(THREE, 0.55, 0.42, 0x0c0d0f, side * 1.14, 0.48, -1.65);
    rear.name = side < 0 ? "RearWheel_L" : "RearWheel_R";
    rollingWheels.push(rear);
    visual.add(rear);

    const steeringPivot = new THREE.Group();
    steeringPivot.name = side < 0 ? "FrontSteer_L" : "FrontSteer_R";
    steeringPivot.position.set(side * 1.12, 0.47, 1.95);
    const front = cylinder(THREE, 0.5, 0.38, 0x0c0d0f, 0, 0, 0);
    front.name = side < 0 ? "FrontWheel_L" : "FrontWheel_R";
    steeringPivot.add(front);
    steeringPivots.push(steeringPivot);
    rollingWheels.push(front);
    visual.add(steeringPivot);
  }

  const captureAnchor = namedAnchor(THREE, "CaptureAnchor", LEKTRO_RIG_PROFILE.captureAnchor);
  const operatorEye = namedAnchor(THREE, "OperatorEye", LEKTRO_RIG_PROFILE.operatorEye);
  const forwardLook = namedAnchor(THREE, "OperatorLook", [-0.45, 1.2, 8]);
  root.add(captureAnchor, operatorEye, forwardLook);

  function setSteering(angle) {
    for (const pivot of steeringPivots) pivot.rotation.y = angle;
  }

  function rotateWheels(distance) {
    const radians = distance / 0.5;
    for (const wheel of rollingWheels) wheel.rotation.x += radians;
  }

  function setLiftProgress(progress) {
    const normalized = Math.max(0, Math.min(1, progress));
    cradleLift.position.y = normalized * LEKTRO_RIG_PROFILE.liftTravel;
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
    profile: LEKTRO_RIG_PROFILE,
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
  return failures;
}
