import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-dedicated-real-building-connector-owns-terminal-leg-v1";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(marker)) {
  const oldBlock = `    transforms.wallCollar.push({
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

  const newBlock = `    // ${marker}
    // A1 has its own source-measured real-building connector and exact uploaded
    // jetway. Do not also stamp the legacy fixed-walkway instance through this
    // gate: that duplicate T4_WALK corridor is the giant white rectangle that
    // visually makes A1 look attached to the elevated walkway instead of the
    // Terminal 4 building. The other 57 gates keep their package walkways.
    if (jetway.g !== "A1") {
      transforms.wallCollar.push({
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
      }
    }`;

  if (!source.includes(oldBlock)) {
    throw new Error(`${path}: legacy fixed-walkway generation block is missing`);
  }
  source = source.replace(oldBlock, newBlock);

  const telemetryAnchor = `  group.userData.a1TerminalConnectionDirection = a1TerminalConnectionDirection;`;
  const telemetry = `${telemetryAnchor}
  group.userData.a1LegacyFixedWalkwaySuppressed = true;
  group.userData.a1TerminalLegAuthority = "${marker}";
  group.userData.nonA1FixedWalkwayCount = transforms.wallCollar.length;`;
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${path}: A1 terminal connection telemetry anchor is missing`);
  }
  source = source.replace(telemetryAnchor, telemetry);
}

for (const token of [
  marker,
  'if (jetway.g !== "A1")',
  "group.userData.a1LegacyFixedWalkwaySuppressed = true",
  `group.userData.a1TerminalLegAuthority = "${marker}"`,
  "group.userData.nonA1FixedWalkwayCount = transforms.wallCollar.length",
]) {
  if (!source.includes(token)) throw new Error(`${path}: A1 legacy walkway suppression is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Removed only A1 from the legacy T4_WALK fixed-corridor instance/frame generation. The other 57 gates retain their fixed walkways; A1 is now owned solely by its real-building connector and exact uploaded jetway.");
