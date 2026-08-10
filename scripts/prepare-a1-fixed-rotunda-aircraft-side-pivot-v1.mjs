import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const authority = "a1-fixed-terminal-rotunda-aircraft-side-pivot-v1";
let source = fs.readFileSync(sourcePath, "utf8");

// The Rotunda is the terminal-side fixed knuckle. Rotating the complete A1
// parent to aim Tunnel A at the aircraft also rotates the Rotunda's authored
// terminal portal away from the building. The live result is the large dark
// apron-facing opening visible in the user's screenshots. Keep the Rotunda and
// its pedestal in their decoded KPHX/source orientation, and rotate only the
// aircraft-side supplied assembly about the measured Rotunda center.
const wholeParentPivotPattern = /  const yawDelta = wrappedAngle\(THREE, targetHeading - currentHeading\);\n  anchor\.rotation\.y \+= yawDelta;\n  anchor\.updateMatrix\(\);\n  group\.updateWorldMatrix\(true, true\);\n  fleet\.updateWorldMatrix\(true, true\);\n  model\.updateWorldMatrix\(true, true\);\n\n  const rotatedRotundaCenter = objectCenterInFleet\(THREE, fleet, rotunda\);\n  anchor\.position\.x \+= fixedRotundaCenter\.x - rotatedRotundaCenter\.x;\n  anchor\.position\.z \+= fixedRotundaCenter\.z - rotatedRotundaCenter\.z;\n  anchor\.updateMatrix\(\);\n  group\.updateWorldMatrix\(true, true\);\n  fleet\.updateWorldMatrix\(true, true\);\n  model\.updateWorldMatrix\(true, true\);/;

const fixedRotundaPivotBlock = `  const yawDelta = wrappedAngle(THREE, targetHeading - currentHeading);
  // ${authority}
  // Rotunda/pedestal stay fixed to the real terminal. Tunnel A and every
  // downstream supplied bridge section rotate together as one rigid aircraft-
  // side assembly around the exact Rotunda center. No supplied vertex is
  // stretched and the relative transforms within the moving assembly remain
  // unchanged.
  const bridgePivot = new THREE.Group();
  bridgePivot.name = "UploadedAirportJetwayA1AircraftSidePivot";
  const bridgePivotCenterWorld = fleet.localToWorld(fixedRotundaCenter.clone());
  const bridgePivotCenterModel = model.worldToLocal(bridgePivotCenterWorld.clone());
  bridgePivot.position.copy(bridgePivotCenterModel);
  model.add(bridgePivot);
  bridgePivot.updateMatrix();
  model.updateWorldMatrix(true, true);

  const bridgeNodes = [
    tunnelA,
    model.getObjectByName("Tunnel_B") || model.getObjectByName("Tunnel_B_Jetway_0"),
    model.getObjectByName("Tunnel_C") || model.getObjectByName("Tunnel_C_Jetway_0"),
    cab,
  ].filter(Boolean);
  const bridgeNodeSet = new Set(bridgeNodes);
  const bridgeRoots = bridgeNodes.filter((node) => {
    let parent = node.parent;
    while (parent && parent !== model && parent !== bridgePivot) {
      if (bridgeNodeSet.has(parent)) return false;
      parent = parent.parent;
    }
    return true;
  });
  if (!bridgeRoots.length || !bridgeRoots.includes(tunnelA)) {
    throw new Error("A1 aircraft-side pivot could not resolve Tunnel A as a moving root");
  }
  for (const root of bridgeRoots) {
    bridgePivot.attach(root);
  }
  bridgePivot.rotation.y = yawDelta;
  bridgePivot.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  group.userData.uploadedJetwayA1AircraftSidePivotAuthority = "${authority}";
  group.userData.uploadedJetwayA1AircraftSidePivotRootCount = bridgeRoots.length;
  group.userData.uploadedJetwayA1RotundaFixedDuringBridgeYaw = true;`;

if (!source.includes(authority)) {
  if (!wholeParentPivotPattern.test(source)) {
    throw new Error(`${sourcePath}: whole-parent A1 yaw block is missing; refusing to guess a pivot rewrite`);
  }
  source = source.replace(wholeParentPivotPattern, fixedRotundaPivotBlock);
}

for (const forbidden of [
  "anchor.rotation.y += yawDelta",
  "const rotatedRotundaCenter = objectCenterInFleet",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: whole-parent A1 Rotunda rotation remains: ${forbidden}`);
  }
}
for (const required of [
  authority,
  'bridgePivot.name = "UploadedAirportJetwayA1AircraftSidePivot"',
  "bridgePivot.attach(root)",
  "bridgePivot.rotation.y = yawDelta",
  "uploadedJetwayA1RotundaFixedDuringBridgeYaw = true",
  "uploadedJetwayA1AircraftSidePivotRootCount = bridgeRoots.length",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: fixed-Rotunda aircraft-side pivot requirement is missing ${required}`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log("Prepared A1 with the terminal Rotunda fixed in its source orientation while Tunnel A/B/C/Cab pivot together toward the aircraft; the terminal portal can no longer rotate out toward the apron.");