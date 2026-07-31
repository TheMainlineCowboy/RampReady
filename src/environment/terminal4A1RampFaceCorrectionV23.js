import * as THREE from "three";

const EXACT_A1_WALL_POINT = new THREE.Vector3(-3.55299146, 0, -40.60699866);
// This source vector runs from the A1 jetway rotunda toward the terminal.
// Ramp-facing detail must be reflected to the opposite side of the wall plane.
const TOWARD_TERMINAL = new THREE.Vector3(0.580968, 0, -0.813927).normalize();
const RAMP_CLEARANCE_METERS = 0.11;

function mirrorObjectPositionToRampFace(object) {
  const relative = object.position.clone().sub(EXACT_A1_WALL_POINT);
  const signedTerminalDepth = relative.dot(TOWARD_TERMINAL);
  object.position
    .addScaledVector(TOWARD_TERMINAL, -2 * signedTerminalDepth)
    .addScaledVector(TOWARD_TERMINAL, -RAMP_CLEARANCE_METERS);
}

function mirrorDetailGroup(detail) {
  if (!detail || detail.userData?.rampFaceCorrectedV23) return 0;
  let corrected = 0;
  for (const child of detail.children) {
    mirrorObjectPositionToRampFace(child);
    child.updateMatrix();
    child.updateMatrixWorld(true);
    corrected += 1;
  }
  detail.userData.rampFaceCorrectedV23 = true;
  detail.userData.rampFaceCorrectionAuthority = "mirror-terminal-directed-A1-detail-across-exact-BGATE1-wall-plane-v23";
  detail.userData.rampClearanceMeters = RAMP_CLEARANCE_METERS;
  return corrected;
}

export function installTerminal4A1RampFaceCorrectionV23(group) {
  if (!group?.isGroup) throw new Error("A1 ramp-face correction requires the source-placed Terminal 4 jetway group");
  const existing = group.getObjectByName("Terminal4_A1_RampFaceCorrection_V23");
  if (existing) return existing;

  const compactFacade = group.getObjectByName("Terminal4_A1_RampFacadeDetail_V19");
  const extendedFacade = group.getObjectByName("Terminal4_A1_ExtendedRampFacade_V22");
  if (!compactFacade || !extendedFacade) {
    throw new Error("A1 ramp-face correction requires both compact V19 and extended V22 facade groups");
  }

  const compactObjectCount = mirrorDetailGroup(compactFacade);
  const extendedObjectCount = mirrorDetailGroup(extendedFacade);
  const marker = new THREE.Group();
  marker.name = "Terminal4_A1_RampFaceCorrection_V23";
  marker.userData.authority = "exact-wall-plane-mirrored-A1-facade-detail-to-ramp-face-v23";
  marker.userData.compactObjectCount = compactObjectCount;
  marker.userData.extendedObjectCount = extendedObjectCount;
  marker.userData.towardTerminal = TOWARD_TERMINAL.toArray();
  marker.userData.rampFacingNormal = TOWARD_TERMINAL.clone().multiplyScalar(-1).toArray();
  marker.userData.exactWallPoint = EXACT_A1_WALL_POINT.toArray();
  marker.userData.rampClearanceMeters = RAMP_CLEARANCE_METERS;
  group.add(marker);
  group.userData.terminal4A1RampFaceCorrectionAuthority = marker.userData.authority;
  return marker;
}
