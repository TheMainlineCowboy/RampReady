import fs from "node:fs";

const path = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const priorAuthority = "a1-aug15-reference-matched-dogleg-v2";
const authority = "a1-aug15-reference-photo-dogleg-orientation-v3";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(priorAuthority)) {
  throw new Error(`${path}: ${priorAuthority} must exist before final photo-orientation correction`);
}

if (!source.includes(authority)) {
  // Re-read the Aug. 15 overhead literally: from the remote Rotunda, the fixed
  // elbow lies on the terminal/opposite side of the movable bridge. Therefore
  // elbow -> Rotunda and Rotunda -> aircraft continue through the Rotunda in the
  // same general direction. The prior v2 "same hemisphere" interpretation put
  // the elbow on the aircraft side and produced the giant diagonal/folded route
  // visible in exact-head overhead evidence.
  const sameSide = "  const rotundaTerminalBranchDirection = bridgeDirection.clone().normalize();";
  const photoSide = `  // ${authority}\n  const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();`;
  if (!source.includes(sameSide)) {
    throw new Error(`${path}: v2 same-side dogleg branch is missing`);
  }
  source = source.replace(sameSide, photoSide);

  const telemetry = `  group.userData.uploadedJetwayA1ReferenceMatchedDoglegAuthority = "${priorAuthority}";`;
  if (!source.includes(telemetry)) {
    throw new Error(`${path}: v2 dogleg telemetry anchor is missing`);
  }
  source = source.replace(
    telemetry,
    `${telemetry}\n  group.userData.uploadedJetwayA1ReferencePhotoOrientationAuthority = "${authority}";`,
  );
}

for (const required of [
  authority,
  "const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();",
  "const doglegSecondLegDirection = rotundaSurfacePoint.clone().sub(doglegElbowPoint).setY(0).normalize();",
  "uploadedJetwayA1ReferencePhotoOrientationAuthority",
]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: final A1 photo-orientation output is missing ${required}`);
  }
}
if (source.includes("const rotundaTerminalBranchDirection = bridgeDirection.clone().normalize();")) {
  throw new Error(`${path}: stale same-side A1 elbow survived final photo-orientation correction`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${authority}: the fixed A1 elbow is terminal/opposite of the remote Rotunda, so the fixed second leg and supplied movable bridge continue through the Rotunda as shown in the Aug. 15 overhead reference; terminal, aircraft, Rotunda and Airport_Jetway.glb remain unmoved.`);
