import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");
const marker = "const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance";
if (!source.includes(marker)) {
  const oldText = `    const lowerWallFit = lowerFacadeWallDistance ?? terminalWallDistance;
    if (lowerWallFit != null && !keepServiceBayOpen) {
      // Measure the wall at ramp level rather than reusing the elevated rotunda
      // intersection. Place the closure toward the ramp so it visibly covers the
      // legacy repeated bay instead of landing behind the authored facade.
      const facadeRampOffset = 0.95;
      const facadeX = jetway.x - ux * lowerWallFit + ux * facadeRampOffset;
      const facadeZ = jetway.z - uz * lowerWallFit + uz * facadeRampOffset;
      transforms.facadeInfill.push({
        position: [facadeX, 1.72, facadeZ],
        yaw,
        scale: [6.4, 3.36, 0.68],
      });`;
  const newText = `    // A recessed lower bay must be closed at the outer facade plane, not at the
    // dark rear wall returned by the ramp-height raycast. Keep only source-qualified
    // service bays open; every other module receives a flush outer-wall closure.
    const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance;
    if (facadeOuterWallFit != null && !keepServiceBayOpen) {
      const facadeRampOffset = 0.28;
      const facadeX = jetway.x - ux * facadeOuterWallFit + ux * facadeRampOffset;
      const facadeZ = jetway.z - uz * facadeOuterWallFit + uz * facadeRampOffset;
      transforms.facadeInfill.push({
        position: [facadeX, 1.74, facadeZ],
        yaw,
        scale: [7.0, 3.42, 0.5],
      });`;
  if (!source.includes(oldText)) throw new Error("Terminal 4 facade visual v7 anchor is missing");
  source = source.replace(oldText, newText);
}

const a1FacadeGuard = 'if (jetway.g !== "A1" && facadeOuterWallFit != null && !keepServiceBayOpen) {';
if (!source.includes(a1FacadeGuard)) {
  const unguardedFacade = "if (facadeOuterWallFit != null && !keepServiceBayOpen) {";
  if (!source.includes(unguardedFacade)) throw new Error("Terminal 4 A1 facade exclusion anchor is missing");
  source = source.replace(unguardedFacade, a1FacadeGuard);
}

const walkwayMarker = "AIR_Jetway01_FixedTerminalWalkways_V13";
if (!source.includes(walkwayMarker)) {
  const oldCollar = `    transforms.wallCollar.push({
      position: [
        jetway.x + connectorTowardX * wallConnectorLength / 2,
        rotundaY,
        jetway.z + connectorTowardZ * wallConnectorLength / 2,
      ],
      yaw: connectorYaw,
      scale: [2.62, 2.48, wallConnectorLength],
    });`;
  const newCollar = `    transforms.wallCollar.push({
      position: [
        jetway.x + connectorTowardX * wallConnectorLength / 2,
        rotundaY,
        jetway.z + connectorTowardZ * wallConnectorLength / 2,
      ],
      yaw: connectorYaw,
      scale: [1, 1, wallConnectorLength],
    });
    const connectorPerpendicular = [-connectorTowardZ, connectorTowardX];
    for (let along = 0.72; along < wallConnectorLength - 0.3; along += 1.65) {
      addTunnelFrame(
        transforms,
        [
          jetway.x + connectorTowardX * along,
          rotundaY,
          jetway.z + connectorTowardZ * along,
        ],
        connectorYaw,
        0,
        connectorPerpendicular,
        2.48,
        2.34,
        0.22,
        0.055,
      );
    }`;
  if (!source.includes(oldCollar)) throw new Error("Terminal 4 fixed walkway v13 collar anchor is missing");
  source = source.replace(oldCollar, newCollar);

  const oldGeometry = `  const box = new THREE.BoxGeometry(1, 1, 1);
  const outerTunnel = createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28);`;
  const newGeometry = `  const box = new THREE.BoxGeometry(1, 1, 1);
  const wallConnectorTunnel = createArchedTunnelGeometry(THREE, 2.48, 2.34, 0.22);
  const outerTunnel = createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28);`;
  if (!source.includes(oldGeometry)) throw new Error("Terminal 4 fixed walkway v13 geometry anchor is missing");
  source = source.replace(oldGeometry, newGeometry);

  const oldInstances = `  addInstances(THREE, group, box, materials.shell, transforms.wallCollar, "AIR_Jetway01_WallCollars");`;
  const newInstances = `  addInstances(THREE, group, wallConnectorTunnel, materials.shell, transforms.wallCollar, "AIR_Jetway01_FixedTerminalWalkways_V13");`;
  if (!source.includes(oldInstances)) throw new Error("Terminal 4 fixed walkway v13 instance anchor is missing");
  source = source.replace(oldInstances, newInstances);
}

fs.writeFileSync(path, source, "utf8");
const prepared = fs.readFileSync(path, "utf8");
for (const token of [
  "const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance",
  a1FacadeGuard,
  "const facadeRampOffset = 0.28",
  "scale: [7.0, 3.42, 0.5]",
  "service bays open; every other module receives a flush outer-wall closure",
  "const connectorPerpendicular = [-connectorTowardZ, connectorTowardX]",
  "const wallConnectorTunnel = createArchedTunnelGeometry(THREE, 2.48, 2.34, 0.22)",
  "AIR_Jetway01_FixedTerminalWalkways_V13",
  "scale: [1, 1, wallConnectorLength]",
]) if (!prepared.includes(token)) throw new Error(`Terminal 4 facade/walkway visual v7-v13 is missing ${token}`);
for (const forbidden of [
  "const lowerWallFit = lowerFacadeWallDistance ?? terminalWallDistance",
  "const facadeRampOffset = 0.95",
  "scale: [6.4, 3.36, 0.68]",
  "if (facadeOuterWallFit != null && !keepServiceBayOpen) {",
  'addInstances(THREE, group, box, materials.shell, transforms.wallCollar, "AIR_Jetway01_WallCollars")',
]) if (prepared.includes(forbidden)) throw new Error(`Terminal 4 facade/walkway visual v7-v13 still contains ${forbidden}`);

console.log("Prepared Terminal 4 facade visual v7 and fixed walkway v13: A1 synthetic infill excluded, flush lower facade elsewhere, and source-textured arched terminal connectors with structural ribs.");
