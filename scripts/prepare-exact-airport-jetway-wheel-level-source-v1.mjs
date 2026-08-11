import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let fleetSource = fs.readFileSync(fleetPath, "utf8");
let installationSource = fs.readFileSync(installationPath, "utf8");
const authority = "exact-source-two-wheel-axle-level-parent-normalization-v1";

const helper = `function measureExactSourceWheelPair(THREE, sourceScene) {
  const mesh = sourceScene.getObjectByName("Tunnel_C_Jetway_0");
  const position = mesh?.geometry?.getAttribute?.("position");
  const geometryIndex = mesh?.geometry?.getIndex?.();
  if (!mesh?.isMesh || !position || position.count < 1000) {
    throw new Error("Exact Airport_Jetway.glb wheel-level normalization is missing Tunnel_C source geometry");
  }
  const indexCount = geometryIndex?.count ?? position.count;
  if (indexCount % 3 !== 0) throw new Error(\`Exact Tunnel_C index count is not triangular: \${indexCount}\`);
  const parent = Array.from({ length: position.count }, (_, index) => index);
  const rank = new Uint8Array(position.count);
  const find = (input) => {
    let root = input;
    while (parent[root] !== root) root = parent[root];
    let cursor = input;
    while (parent[cursor] !== cursor) {
      const next = parent[cursor];
      parent[cursor] = root;
      cursor = next;
    }
    return root;
  };
  const union = (left, right) => {
    let a = find(left);
    let b = find(right);
    if (a === b) return;
    if (rank[a] < rank[b]) [a, b] = [b, a];
    parent[b] = a;
    if (rank[a] === rank[b]) rank[a] += 1;
  };
  const point = new THREE.Vector3();
  const ownerByPosition = new Map();
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    point.fromBufferAttribute(position, vertexIndex);
    const key = [point.x, point.y, point.z].map((value) => Math.round(value / 1e-5)).join(":");
    const owner = ownerByPosition.get(key);
    if (owner === undefined) ownerByPosition.set(key, vertexIndex);
    else union(vertexIndex, owner);
  }
  const indexAt = (offset) => geometryIndex ? geometryIndex.getX(offset) : offset;
  const triangleCountByRoot = new Map();
  for (let offset = 0; offset < indexCount; offset += 3) {
    const a = indexAt(offset);
    const b = indexAt(offset + 1);
    const c = indexAt(offset + 2);
    union(a, b);
    union(b, c);
    union(c, a);
  }
  const verticesByRoot = new Map();
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    const root = find(vertexIndex);
    if (!verticesByRoot.has(root)) verticesByRoot.set(root, []);
    verticesByRoot.get(root).push(vertexIndex);
  }
  for (let offset = 0; offset < indexCount; offset += 3) {
    const root = find(indexAt(offset));
    triangleCountByRoot.set(root, (triangleCountByRoot.get(root) || 0) + 1);
  }
  sourceScene.updateMatrixWorld(true);
  const wheels = [];
  for (const [root, vertices] of verticesByRoot) {
    if (triangleCountByRoot.get(root) !== 1174) continue;
    const box = new THREE.Box3();
    for (const vertexIndex of vertices) {
      point.fromBufferAttribute(position, vertexIndex);
      mesh.localToWorld(point);
      box.expandByPoint(point);
    }
    wheels.push({ root, box, center: box.getCenter(new THREE.Vector3()), minimumY: box.min.y });
  }
  if (wheels.length !== 2) throw new Error(\`Exact Airport_Jetway.glb expected two 1174-triangle authored wheels, received \${wheels.length}\`);
  wheels.sort((left, right) => left.center.x - right.center.x || left.center.z - right.center.z);
  return wheels;
}

`;

if (!fleetSource.includes(authority)) {
  const helperAnchor = "async function loadExactPrototype(THREE) {";
  if (!fleetSource.includes(helperAnchor)) throw new Error(`${fleetPath}: exact prototype loader anchor is missing`);
  fleetSource = fleetSource.replace(helperAnchor, `${helper}${helperAnchor}`);

  fleetSource = fleetSource
    .replace("  const sourceRotundaCenter = new THREE.Box3().setFromObject(sourceRotunda).getCenter(new THREE.Vector3());", "  let sourceRotundaCenter = new THREE.Box3().setFromObject(sourceRotunda).getCenter(new THREE.Vector3());")
    .replace("  const sourceCabCenter = new THREE.Box3().setFromObject(sourceCab).getCenter(new THREE.Vector3());", "  let sourceCabCenter = new THREE.Box3().setFromObject(sourceCab).getCenter(new THREE.Vector3());");

  const longitudinalAnchor = "  const sourceLongitudinalAxis = sourceCabCenter.clone().sub(sourceRotundaCenter);";
  const levelBlock = `  // ${authority}\n  // The supplied Sketchfab/FBX exporter frame leaves the exact paired bogie\n  // wheels rolled relative to the ramp. Remove only that rigid exporter roll\n  // from the complete source scene before gate yaw/placement. No authored\n  // child, mesh, triangle, UV, material or relative transform is changed.\n  const sourceWheelPairBeforeLevel = measureExactSourceWheelPair(THREE, sourceScene);\n  const wheelLevelAxis = sourceCabCenter.clone().sub(sourceRotundaCenter);\n  wheelLevelAxis.y = 0;\n  if (wheelLevelAxis.lengthSq() < 1) throw new Error("Exact Airport_Jetway.glb wheel-level longitudinal axis is invalid");\n  wheelLevelAxis.normalize();\n  const wheelAxleBeforeLevel = sourceWheelPairBeforeLevel[1].center.clone().sub(sourceWheelPairBeforeLevel[0].center);\n  const axleCross = new THREE.Vector3().crossVectors(wheelLevelAxis, wheelAxleBeforeLevel);\n  if (Math.abs(axleCross.y) < 0.5) throw new Error("Exact Airport_Jetway.glb authored wheel axle cannot define exporter roll");\n  const wheelRollCorrectionRadians = Math.atan2(-wheelAxleBeforeLevel.y, axleCross.y);\n  if (!Number.isFinite(wheelRollCorrectionRadians) || Math.abs(wheelRollCorrectionRadians) > THREE.MathUtils.degToRad(8)) {\n    throw new Error(\`Exact Airport_Jetway.glb exporter roll correction is invalid: \${THREE.MathUtils.radToDeg(wheelRollCorrectionRadians)} deg\`);\n  }\n  const wheelRollCorrection = new THREE.Quaternion().setFromAxisAngle(wheelLevelAxis, wheelRollCorrectionRadians);\n  sourceScene.quaternion.premultiply(wheelRollCorrection);\n  sourceScene.updateMatrixWorld(true);\n  const sourceWheelPairAfterLevel = measureExactSourceWheelPair(THREE, sourceScene);\n  const wheelBottomDeltaAfterLevel = Math.abs(sourceWheelPairAfterLevel[0].minimumY - sourceWheelPairAfterLevel[1].minimumY);\n  if (wheelBottomDeltaAfterLevel > 0.01) {\n    throw new Error(\`Exact Airport_Jetway.glb paired wheel bottoms remain unlevel after rigid normalization: \${wheelBottomDeltaAfterLevel} m\`);\n  }\n  sourceRotundaCenter = new THREE.Box3().setFromObject(sourceRotunda).getCenter(new THREE.Vector3());\n  sourceCabCenter = new THREE.Box3().setFromObject(sourceCab).getCenter(new THREE.Vector3());\n`;
  if (!fleetSource.includes(longitudinalAnchor)) throw new Error(`${fleetPath}: source longitudinal-axis anchor is missing`);
  fleetSource = fleetSource.replace(longitudinalAnchor, `${levelBlock}${longitudinalAnchor}`);

  const yawAssignment = "  sourceScene.rotation.y = axisCorrectionRadians;";
  const yawRigid = "  sourceScene.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), axisCorrectionRadians));";
  if (!fleetSource.includes(yawAssignment)) throw new Error(`${fleetPath}: source yaw assignment anchor is missing`);
  fleetSource = fleetSource.replace(yawAssignment, yawRigid);

  const positionedAnchor = "  sourceScene.updateMatrixWorld(true);\n\n  const aligned = new THREE.Group();";
  const positionedCheck = `  sourceScene.updateMatrixWorld(true);\n  const groundedSourceWheelPair = measureExactSourceWheelPair(THREE, sourceScene);\n  const groundedWheelBottomDelta = Math.abs(groundedSourceWheelPair[0].minimumY - groundedSourceWheelPair[1].minimumY);\n  const maximumGroundedWheelBottom = Math.max(Math.abs(groundedSourceWheelPair[0].minimumY), Math.abs(groundedSourceWheelPair[1].minimumY));\n  if (groundedWheelBottomDelta > 0.01 || maximumGroundedWheelBottom > 0.01) {\n    throw new Error(\`Exact Airport_Jetway.glb paired wheels are not the normalized ground contact: bottoms=\${groundedSourceWheelPair.map((wheel) => wheel.minimumY).join(",")}\`);\n  }\n\n  const aligned = new THREE.Group();`;
  if (!fleetSource.includes(positionedAnchor)) throw new Error(`${fleetPath}: grounded prototype anchor is missing`);
  fleetSource = fleetSource.replace(positionedAnchor, positionedCheck);

  const authorityAnchor = "  aligned.userData.parentAxisCorrectionRadians = axisCorrectionRadians;";
  if (!fleetSource.includes(authorityAnchor)) throw new Error(`${fleetPath}: aligned prototype authority anchor is missing`);
  fleetSource = fleetSource.replace(authorityAnchor, `${authorityAnchor}\n  aligned.userData.wheelPairLevelAuthority = "${authority}";\n  aligned.userData.wheelPairRollCorrectionRadians = wheelRollCorrectionRadians;\n  aligned.userData.wheelPairBottomDeltaMeters = groundedWheelBottomDelta;`);
}

for (const required of [
  authority,
  "measureExactSourceWheelPair",
  "triangleCountByRoot.get(root) !== 1174",
  "wheelRollCorrectionRadians",
  "wheelBottomDeltaAfterLevel > 0.01",
  "groundedWheelBottomDelta > 0.01",
  "sourceScene.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), axisCorrectionRadians))",
]) if (!fleetSource.includes(required)) throw new Error(`${fleetPath}: exact wheel-level source normalization is missing ${required}`);
if (fleetSource.includes("sourceScene.rotation.y = axisCorrectionRadians")) {
  throw new Error(`${fleetPath}: Euler yaw assignment would overwrite exact source roll normalization`);
}

installationSource = installationSource.replace(
  "const BOGIE_TIRE_CONTACT_CORRECTION_METERS = 0.06;",
  "const BOGIE_TIRE_CONTACT_CORRECTION_METERS = 0; // exact source wheel pair is grounded by prototype roll normalization",
);
if (!installationSource.includes("const BOGIE_TIRE_CONTACT_CORRECTION_METERS = 0;")) {
  throw new Error(`${installationPath}: retired 6 cm fleet-wide ground fudge survived exact wheel-level normalization`);
}

fs.writeFileSync(fleetPath, fleetSource, "utf8");
fs.writeFileSync(installationPath, installationSource, "utf8");
console.log("Prepared exact Airport_Jetway.glb as one rigid source assembly with its authored two-wheel axle level to the ramp; removed the obsolete 6 cm fleet-wide vertical fudge.");
