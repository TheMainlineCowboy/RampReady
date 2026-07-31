import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${path}: missing A1 fixed-walkway v13 ${label} anchor`);
  source = source.replace(before, after);
}

replaceOnce(
  `    transforms.wallCollar.push({
      position: [
        jetway.x + connectorTowardX * wallConnectorLength / 2,
        rotundaY,
        jetway.z + connectorTowardZ * wallConnectorLength / 2,
      ],
      yaw: connectorYaw,
      scale: [2.62, 2.48, wallConnectorLength],
    });`,
  `    transforms.wallCollar.push({
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
    }`,
  "const connectorPerpendicular = [-connectorTowardZ, connectorTowardX]",
  "framed fixed connector",
);

replaceOnce(
  `  const box = new THREE.BoxGeometry(1, 1, 1);
  const outerTunnel = createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28);`,
  `  const box = new THREE.BoxGeometry(1, 1, 1);
  const wallConnectorTunnel = createArchedTunnelGeometry(THREE, 2.48, 2.34, 0.22);
  const outerTunnel = createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28);`,
  "const wallConnectorTunnel = createArchedTunnelGeometry",
  "arched fixed connector geometry",
);

replaceOnce(
  `  addInstances(THREE, group, box, materials.shell, transforms.wallCollar, "AIR_Jetway01_WallCollars");`,
  `  addInstances(THREE, group, wallConnectorTunnel, materials.shell, transforms.wallCollar, "AIR_Jetway01_FixedTerminalWalkways_V13");`,
  "AIR_Jetway01_FixedTerminalWalkways_V13",
  "fixed connector instances",
);

for (const token of [
  "const connectorPerpendicular = [-connectorTowardZ, connectorTowardX]",
  "const wallConnectorTunnel = createArchedTunnelGeometry(THREE, 2.48, 2.34, 0.22)",
  "AIR_Jetway01_FixedTerminalWalkways_V13",
  "scale: [1, 1, wallConnectorLength]",
]) {
  if (!source.includes(token)) throw new Error(`${path}: prepared A1 fixed-walkway v13 is missing ${token}`);
}
if (source.includes('addInstances(THREE, group, box, materials.shell, transforms.wallCollar, "AIR_Jetway01_WallCollars")')) {
  throw new Error(`${path}: obsolete stretched box wall collar remains active`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared A1 fixed terminal walkway v13: source-textured arched tunnel, 1.65 m structural ribs, unchanged wall fit and rotunda pivot.");
