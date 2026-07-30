import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");

const replaceRequired = (oldText, newText, label) => {
  if (source.includes(newText)) return;
  if (!source.includes(oldText)) throw new Error(`${jetwayPath}: CRJ v5 anchor is missing for ${label}`);
  source = source.replace(oldText, newText);
};

const replaceAllRequired = (oldText, newText, label) => {
  if (source.includes(newText)) return;
  if (!source.includes(oldText)) throw new Error(`${jetwayPath}: CRJ v5 token is missing for ${label}`);
  source = source.replaceAll(oldText, newText);
};

replaceAllRequired(
  'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v4"',
  'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v5"',
  "detail level",
);
replaceAllRequired(
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ forward-door longitudinal station",
);
replaceAllRequired(
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "CRJ forward-door lateral station",
);
replaceRequired(
  'const OPEN_SERVICE_BAY_GATES = new Set(["A5", "A13", "A21", "B5", "B13", "B21"]);',
  `const OPEN_SERVICE_BAY_GATES = new Set(["A13", "A21", "B13", "B21"]);
const CLOSED_SERVICE_DOOR_GATES = new Set(["A3", "A8", "A17", "A24", "B2", "B7", "B14", "B19", "B26"]);
const FACADE_VENT_GATES = new Set(["A6", "A11", "A19", "A27", "B4", "B10", "B17", "B24"]);`,
  "non-repetitive lower-facade feature sets",
);
replaceRequired(
  "  let terminal4LowerFacadeFitCount = 0;",
  "  let terminal4LowerFacadeFitCount = 0;\n  let terminal4OpenServiceBayCount = 0;\n  let a1DoorContactErrorMeters = null;",
  "runtime counters",
);
replaceRequired(
  `    const gateNumber = Number.parseInt(jetway.g.slice(1), 10);
    const keepServiceBayOpen = OPEN_SERVICE_BAY_GATES.has(jetway.g);
    const lowerWallFit = lowerFacadeWallDistance ?? terminalWallDistance;`,
  `    const sourceFacadeRecessMeters = lowerFacadeWallDistance != null && terminalWallDistance != null
      ? lowerFacadeWallDistance - terminalWallDistance
      : 0;
    const keepServiceBayOpen = OPEN_SERVICE_BAY_GATES.has(jetway.g) && sourceFacadeRecessMeters >= 1.4;
    if (keepServiceBayOpen) terminal4OpenServiceBayCount += 1;
    const lowerWallFit = lowerFacadeWallDistance ?? terminalWallDistance;`,
  "source-recess service-bay qualification",
);
replaceRequired(
  `      if (Number.isInteger(gateNumber) && gateNumber % 3 === 0) {
        transforms.facadeDoor.push({`,
  `      if (CLOSED_SERVICE_DOOR_GATES.has(jetway.g)) {
        transforms.facadeDoor.push({`,
  "irregular closed service doors",
);
replaceRequired(
  `      if (Number.isInteger(gateNumber) && gateNumber % 2 === 0) {
        transforms.facadeVent.push({`,
  `      if (FACADE_VENT_GATES.has(jetway.g)) {
        transforms.facadeVent.push({`,
  "irregular facade vents",
);

for (const [oldText, newText, label] of [
  ["    const bridgeStart = 1.75;", "    const bridgeStart = 1.42;", "bridge start"],
  ["    const rotundaY = 4.35;", "    const rotundaY = 3.92;", "rotunda height"],
  ['    const cabinY = jetway.g === "A1" ? 2.95 : 3.08;', '    const cabinY = jetway.g === "A1" ? 2.66 : 2.72;', "CRJ door sill height"],
  ["      scale: [2.62, 2.48, wallConnectorLength],", "      scale: [2.24, 2.12, wallConnectorLength],", "wall collar size"],
  ["    transforms.rotundaBody.push({ position: [jetway.x, rotundaY - 0.05, jetway.z], yaw, scale: [1.62, 2.34, 1.62] });", "    transforms.rotundaBody.push({ position: [jetway.x, rotundaY - 0.05, jetway.z], yaw, scale: [1.4, 2.08, 1.4] });", "rotunda body size"],
  ["    transforms.rotundaWindow.push({ position: [jetway.x, rotundaY + 0.25, jetway.z], yaw, scale: [1.65, 0.58, 1.65] });", "    transforms.rotundaWindow.push({ position: [jetway.x, rotundaY + 0.2, jetway.z], yaw, scale: [1.43, 0.52, 1.43] });", "rotunda glazing size"],
  ["    transforms.rotundaRoof.push({ position: [jetway.x, rotundaY + 1.48, jetway.z], yaw, scale: [1.78, 0.15, 1.78] });", "    transforms.rotundaRoof.push({ position: [jetway.x, rotundaY + 1.26, jetway.z], yaw, scale: [1.52, 0.13, 1.52] });", "rotunda roof size"],
  ["    transforms.pivotCap.push({ position: [jetway.x, rotundaY + 1.67, jetway.z], yaw, scale: [0.5, 0.14, 0.5] });", "    transforms.pivotCap.push({ position: [jetway.x, rotundaY + 1.42, jetway.z], yaw, scale: [0.42, 0.12, 0.42] });", "pivot cap size"],
  ["    transforms.supportColumns.push({ position: [jetway.x, 2.0, jetway.z], scale: [0.34, 4.0, 0.34] });", "    transforms.supportColumns.push({ position: [jetway.x, 1.78, jetway.z], scale: [0.3, 3.56, 0.3] });", "rotunda support column"],
  ["    transforms.liftSleeves.push({ position: [jetway.x, 1.45, jetway.z], scale: [0.54, 2.4, 0.54] });", "    transforms.liftSleeves.push({ position: [jetway.x, 1.28, jetway.z], scale: [0.46, 2.08, 0.46] });", "rotunda lift sleeve"],
  ["    transforms.supportFeet.push({ position: [jetway.x, 0.16, jetway.z], yaw, scale: [1.3, 0.22, 1.3] });", "    transforms.supportFeet.push({ position: [jetway.x, 0.13, jetway.z], yaw, scale: [1.08, 0.18, 1.08] });", "rotunda foot"],
  ["      scale: [2.34, 2.2, 0.18],", "      scale: [2.08, 2.02, 0.16],", "telescoping overlap band"],
  ["          2.48,\n          2.38,\n          0.28,", "          2.18,\n          2.12,\n          0.24,", "outer tunnel frame"],
  ["          2.22,\n          2.22,\n          0.24,", "          1.96,\n          2.02,\n          0.2,", "inner tunnel frame"],
  ["        const sideOffset = side * 1.16;", "        const sideOffset = side * 1.02;", "panel seam offset"],
  ["            scale: [0.032, 1.92, 0.05],", "            scale: [0.028, 1.74, 0.045],", "panel seam scale"],
  ["    transforms.cabin.push({ position: [endX, cabinY, endZ], yaw, scale: [1, 1, 2.15] });", "    transforms.cabin.push({ position: [endX, cabinY, endZ], yaw, scale: [1, 1, 1.82] });", "aircraft cabin length"],
  ["      position: [endX + ux * 1.1, cabinY + 0.34, endZ + uz * 1.1],", "      position: [endX + ux * 0.94, cabinY + 0.29, endZ + uz * 0.94],", "front window position"],
  ["      scale: [1.94, 0.68, 0.05],", "      scale: [1.72, 0.58, 0.045],", "front window size"],
  ["        position: [endX + px * side * 1.18, cabinY + 0.25, endZ + pz * side * 1.18],", "        position: [endX + px * side * 1.02, cabinY + 0.22, endZ + pz * side * 1.02],", "side window position"],
  ["        scale: [0.05, 0.62, 1.16],", "        scale: [0.045, 0.54, 0.98],", "side window size"],
  ["        position: [endX + ux * 1.2 + px * side * 0.86, cabinY + 0.88, endZ + uz * 1.2 + pz * side * 0.86],", "        position: [endX + ux * 1.0 + px * side * 0.74, cabinY + 0.78, endZ + uz * 1.0 + pz * side * 0.74],", "work light position"],
  ["    const bellowsStart = bridgeEnd + 0.96;", "    const bellowsStart = bridgeEnd + 0.82;", "bellows start"],
  ["      const width = 2.18 - fold * 0.035;", "      const width = 1.92 - fold * 0.03;", "bellows width"],
  ["      const height = 1.96 - fold * 0.025;", "      const height = 1.78 - fold * 0.022;", "bellows height"],
  ["      position: [jetway.x + ux * (bellowsStart + 0.62), cabinY - 0.75, jetway.z + uz * (bellowsStart + 0.62)],", "      position: [jetway.x + ux * (bellowsStart + 0.58), cabinY - 0.68, jetway.z + uz * (bellowsStart + 0.58)],", "bumper position"],
  ["      scale: [1.84, 0.15, 0.14],", "      scale: [1.62, 0.13, 0.12],", "bumper size"],
  ["    const bogieAlong = bridgeEnd - 2.45;", "    const bogieAlong = bridgeEnd - 2.15;", "bogie station"],
  ["    transforms.bogies.push({ position: [bogieX, 0.55, bogieZ], yaw, scale: [2.08, 0.34, 0.92] });", "    transforms.bogies.push({ position: [bogieX, 0.48, bogieZ], yaw, scale: [1.78, 0.3, 0.78] });", "bogie size"],
  ["    transforms.axles.push({ position: [bogieX, 0.42, bogieZ], yaw, scale: [2.22, 0.13, 0.13] });", "    transforms.axles.push({ position: [bogieX, 0.37, bogieZ], yaw, scale: [1.9, 0.11, 0.11] });", "axle size"],
  ["          position: [bogieX + px * side * 0.9 + ux * fore, 0.42, bogieZ + pz * side * 0.9 + uz * fore],", "          position: [bogieX + px * side * 0.78 + ux * fore, 0.37, bogieZ + pz * side * 0.78 + uz * fore],", "wheel position"],
  ["          scale: [0.36, 0.24, 0.36],", "          scale: [0.31, 0.21, 0.31],", "wheel size"],
  ["      const stairOrigin = [endX - ux * 1.25 - px * 2.35, endZ - uz * 1.25 - pz * 2.35];", "      const stairOrigin = [endX - ux * 1.08 - px * 2.0, endZ - uz * 1.08 - pz * 2.0];", "service stair location"],
  ["  const outerTunnel = createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28);", "  const outerTunnel = createArchedTunnelGeometry(THREE, 2.18, 2.12, 0.24);", "outer tunnel geometry"],
  ["  const innerTunnel = createArchedTunnelGeometry(THREE, 2.18, 2.18, 0.24);", "  const innerTunnel = createArchedTunnelGeometry(THREE, 1.96, 2.02, 0.2);", "inner tunnel geometry"],
  ["  const cabin = createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22);", "  const cabin = createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18);", "cabin geometry"],
]) replaceRequired(oldText, newText, label);

replaceRequired(
  `    transforms.bumper.push({
      position: [jetway.x + ux * (bellowsStart + 0.58), cabinY - 0.68, jetway.z + uz * (bellowsStart + 0.58)],
      yaw,
      scale: [1.62, 0.13, 0.12],
    });`,
  `    transforms.bumper.push({
      position: [jetway.x + ux * (bellowsStart + 0.58), cabinY - 0.68, jetway.z + uz * (bellowsStart + 0.58)],
      yaw,
      scale: [1.62, 0.13, 0.12],
    });
    if (jetway.g === "A1") {
      const contactAlong = bellowsStart + 0.58;
      a1DoorContactErrorMeters = Math.abs(contactAlong - distance);
    }`,
  "A1 door-contact evidence",
);
replaceRequired(
  "  group.userData.openServiceBayCount = OPEN_SERVICE_BAY_GATES.size;",
  "  group.userData.openServiceBayCount = terminal4OpenServiceBayCount;\n  group.userData.a1DoorContactErrorMeters = a1DoorContactErrorMeters;",
  "measured service-bay and door-contact evidence",
);
replaceRequired(
  '  group.userData.facadeInfillAuthority = "source-positioned-gate-module-closures-with-limited-service-openings";',
  '  group.userData.facadeInfillAuthority = "source-recess-qualified-service-bays-with-irregular-closed-facade-details";',
  "facade authority",
);
replaceAllRequired(
  '  group.userData.visualAuthority = "faithful-reconstruction-of-referenced-fsx-air-jetway01-library-object";',
  '  group.userData.visualAuthority = "CRJ700-scaled-reconstruction-of-referenced-fsx-air-jetway01-library-object";',
  "visual authority",
);

for (const token of [
  'fsx-air-jetway01-exact-textured-crj-scale-v5',
  'CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55',
  'CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28',
  'const sourceFacadeRecessMeters',
  'CLOSED_SERVICE_DOOR_GATES.has(jetway.g)',
  'FACADE_VENT_GATES.has(jetway.g)',
  'createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)',
  'group.userData.a1DoorContactErrorMeters',
]) {
  if (!source.includes(token)) throw new Error(`${jetwayPath}: CRJ v5 preparation is missing ${token}`);
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log("Prepared Terminal 4 AIR_Jetway01 v5: CRJ700 proportions, measured A1 door contact, recess-qualified service bays, and non-repetitive lower-facade details.");
