import fs from "node:fs";

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`${label}: expected source anchor is missing`);
  return source.replace(oldText, newText);
}

function replaceToken(source, oldToken, newToken, label) {
  if (source.includes(newToken)) return source;
  if (!source.includes(oldToken)) throw new Error(`${label}: expected token ${oldToken} is missing`);
  return source.replaceAll(oldToken, newToken);
}

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let jetways = fs.readFileSync(jetwayPath, "utf8");

for (const [oldToken, newToken, label] of [
  ['detailLevel: "fsx-air-jetway01-faithful-articulated-v2"', 'detailLevel: "fsx-air-jetway01-crj-scale-articulated-v3"', "jetway detail level"],
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35", "CRJ forward-door longitudinal target"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35", "CRJ forward-door lateral target"],
  ["AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.78", "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.65", "jetway contact clearance"],
  ["const bridgeStart = 2.35;", "const bridgeStart = 1.75;", "jetway bridge start"],
  ["clamp(distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 13.5, 30.5)", "clamp(distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5)", "jetway reach limits"],
  ["const rotundaY = 4.62;", "const rotundaY = 4.35;", "rotunda height"],
  ['const cabinY = jetway.g === "A1" ? 3.05 : 3.2;', 'const cabinY = jetway.g === "A1" ? 2.95 : 3.08;', "aircraft cabin height"],
  ["scale: [3.6, 3.1, wallConnectorLength]", "scale: [2.62, 2.48, wallConnectorLength]", "wall connector proportions"],
  ["scale: [2.1, 2.75, 2.1]", "scale: [1.62, 2.34, 1.62]", "rotunda body proportions"],
  ["scale: [2.13, 0.78, 2.13]", "scale: [1.65, 0.58, 1.65]", "rotunda glazing proportions"],
  ["scale: [2.28, 0.18, 2.28]", "scale: [1.78, 0.15, 1.78]", "rotunda roof proportions"],
  ["scale: [0.62, 0.18, 0.62]", "scale: [0.5, 0.14, 0.5]", "rotunda pivot cap"],
  ["scale: [1.8, 0.26, 1.8]", "scale: [1.3, 0.22, 1.3]", "rotunda support foot"],
  ["scale: [3.12, 2.52, 0.22]", "scale: [2.34, 2.2, 0.18]", "telescoping overlap band"],
  ["const ribSpacing = 1.35;", "const ribSpacing = 1.65;", "tunnel rib spacing"],
  ["          3.25,\n          2.62,\n          0.36,", "          2.48,\n          2.38,\n          0.28,", "outer tunnel frame dimensions"],
  ["          2.94,\n          2.42,\n          0.32,", "          2.22,\n          2.22,\n          0.24,", "inner tunnel frame dimensions"],
  ["const sideOffset = side * 1.55;", "const sideOffset = side * 1.16;", "panel seam lateral offset"],
  ["scale: [0.035, 2.15, 0.055]", "scale: [0.032, 1.92, 0.05]", "panel seam proportions"],
  ["scale: [1, 1, 3.15]", "scale: [1, 1, 2.15]", "aircraft cabin length"],
  ["endX + ux * 1.61", "endX + ux * 1.1", "cabin front longitudinal position"],
  ["endZ + uz * 1.61", "endZ + uz * 1.1", "cabin front longitudinal position z"],
  ["scale: [2.48, 0.82, 0.055]", "scale: [1.94, 0.68, 0.05]", "cabin front window"],
  ["px * side * 1.49", "px * side * 1.18", "cabin side offset x"],
  ["pz * side * 1.49", "pz * side * 1.18", "cabin side offset z"],
  ["scale: [0.055, 0.72, 1.75]", "scale: [0.05, 0.62, 1.16]", "cabin side window"],
  ["endX + ux * 1.72 + px * side * 1.12", "endX + ux * 1.2 + px * side * 0.86", "work light position x"],
  ["endZ + uz * 1.72 + pz * side * 1.12", "endZ + uz * 1.2 + pz * side * 0.86", "work light position z"],
  ["const bellowsStart = bridgeEnd + 1.48;", "const bellowsStart = bridgeEnd + 0.96;", "bellows start"],
  ["for (let fold = 0; fold < 7; fold += 1)", "for (let fold = 0; fold < 5; fold += 1)", "bellows fold count"],
  ["fold * 0.15", "fold * 0.12", "bellows fold spacing"],
  ["const width = 2.62 - fold * 0.045;", "const width = 2.18 - fold * 0.035;", "bellows width"],
  ["const height = 2.15 - fold * 0.035;", "const height = 1.96 - fold * 0.025;", "bellows height"],
  ["scale: [width, 0.085, 0.105]", "scale: [width, 0.07, 0.08]", "bellows horizontal section"],
  ["scale: [0.085, height, 0.105]", "scale: [0.07, height, 0.08]", "bellows vertical section"],
  ["bellowsStart + 1.04", "bellowsStart + 0.62", "aircraft bumper reach"],
  ["cabinY - 0.83", "cabinY - 0.75", "aircraft bumper height"],
  ["scale: [2.15, 0.18, 0.18]", "scale: [1.84, 0.15, 0.14]", "aircraft bumper dimensions"],
  ["const bogieAlong = bridgeEnd - 3.15;", "const bogieAlong = bridgeEnd - 2.45;", "bogie longitudinal position"],
  ["px * side * 0.68", "px * side * 0.52", "lift column offset x"],
  ["pz * side * 0.68", "pz * side * 0.52", "lift column offset z"],
  ["scale: [2.75, 0.4, 1.18]", "scale: [2.08, 0.34, 0.92]", "wheel bogie dimensions"],
  ["scale: [2.95, 0.15, 0.15]", "scale: [2.22, 0.13, 0.13]", "axle dimensions"],
  ["px * side * 1.2", "px * side * 0.9", "wheel offset x"],
  ["pz * side * 1.2", "pz * side * 0.9", "wheel offset z"],
  ["scale: [0.43, 0.27, 0.43]", "scale: [0.36, 0.24, 0.36]", "wheel dimensions"],
  ["endX - ux * 1.8 - px * 3.1", "endX - ux * 1.25 - px * 2.35", "service stair position x"],
  ["endZ - uz * 1.8 - pz * 3.1", "endZ - uz * 1.25 - pz * 2.35", "service stair position z"],
  ["const outerTunnel = createArchedTunnelGeometry(THREE, 3.2, 2.56, 0.36);", "const outerTunnel = createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28);", "outer tunnel geometry"],
  ["const innerTunnel = createArchedTunnelGeometry(THREE, 2.9, 2.36, 0.32);", "const innerTunnel = createArchedTunnelGeometry(THREE, 2.18, 2.18, 0.24);", "inner tunnel geometry"],
  ["const cabin = createArchedTunnelGeometry(THREE, 3.05, 2.72, 0.28);", "const cabin = createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22);", "aircraft cabin geometry"],
]) {
  jetways = replaceToken(jetways, oldToken, newToken, label);
}

if (!jetways.includes("OPEN_SERVICE_BAY_GATES")) {
  jetways = replaceOnce(
    jetways,
    "const AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.65;",
    `const AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.65;\n\n// Keep only a limited set of deliberate ground-service openings. The legacy\n// gate atlas repeats the same black bay at nearly every module, which is not\n// representative of the Terminal 4 ramp facade.\nconst OPEN_SERVICE_BAY_GATES = new Set([\"A5\", \"A13\", \"A21\", \"B5\", \"B13\", \"B21\"]);`,
    "service-bay authority",
  );
}

if (!jetways.includes('facadeWall: standard("Terminal 4 lower facade infill"')) {
  jetways = replaceOnce(
    jetways,
    '    bellows: standard("AIR_Jetway01 aircraft bellows", 0x1b1e21, 0.92, 0.02),',
    `    bellows: standard("AIR_Jetway01 aircraft bellows", 0x1b1e21, 0.92, 0.02),\n    facadeWall: standard("Terminal 4 lower facade infill", 0xc7b8a3, 0.78, 0.04),\n    facadeDoor: standard("Terminal 4 closed service door", 0x766f67, 0.72, 0.12),\n    facadeVent: standard("Terminal 4 facade ventilation grille", 0x4d5355, 0.66, 0.28),`,
    "facade materials",
  );
}

if (!jetways.includes("facadeInfill: []")) {
  jetways = replaceOnce(
    jetways,
    "    lights: [], markers: [], steps: [], rails: [], cableSegments: [],",
    "    lights: [], markers: [], steps: [], rails: [], cableSegments: [],\n    facadeInfill: [], facadeDoor: [], facadeVent: [],",
    "facade transform collections",
  );
}

if (!jetways.includes("let terminal4FacadeInfillCount = 0")) {
  jetways = replaceOnce(
    jetways,
    "  let a1TerminalWallDistance = null;",
    "  let a1TerminalWallDistance = null;\n  let terminal4FacadeInfillCount = 0;",
    "facade counter",
  );
}

if (!jetways.includes("OPEN_SERVICE_BAY_GATES.has(jetway.g)")) {
  jetways = replaceOnce(
    jetways,
    `    if (terminalWallDistance != null) terminalConnectedCount += 1;\n    if (jetway.g === "A1") a1TerminalWallDistance = terminalWallDistance;\n    transforms.wallCollar.push({`,
    `    if (terminalWallDistance != null) terminalConnectedCount += 1;\n    if (jetway.g === "A1") a1TerminalWallDistance = terminalWallDistance;\n\n    const gateNumber = Number.parseInt(jetway.g.slice(1), 10);\n    const keepServiceBayOpen = OPEN_SERVICE_BAY_GATES.has(jetway.g);\n    if (terminalWallDistance != null && !keepServiceBayOpen) {\n      const facadeX = jetway.x - ux * Math.max(0.08, terminalWallDistance - 0.06);\n      const facadeZ = jetway.z - uz * Math.max(0.08, terminalWallDistance - 0.06);\n      transforms.facadeInfill.push({\n        position: [facadeX, 1.12, facadeZ],\n        yaw,\n        scale: [5.55, 2.18, 0.16],\n      });\n      if (Number.isInteger(gateNumber) && gateNumber % 3 === 0) {\n        transforms.facadeDoor.push({\n          position: [facadeX + px * 1.35 + ux * 0.1, 0.94, facadeZ + pz * 1.35 + uz * 0.1],\n          yaw,\n          scale: [1.05, 1.78, 0.12],\n        });\n      }\n      if (Number.isInteger(gateNumber) && gateNumber % 2 === 0) {\n        transforms.facadeVent.push({\n          position: [facadeX - px * 1.45 + ux * 0.1, 1.54, facadeZ - pz * 1.45 + uz * 0.1],\n          yaw,\n          scale: [1.16, 0.32, 0.12],\n        });\n      }\n      terminal4FacadeInfillCount += 1;\n    }\n\n    transforms.wallCollar.push({`,
    "source-positioned lower-facade infill",
  );
}

if (!jetways.includes('"Terminal4_LowerFacadeInfillPanels"')) {
  jetways = replaceOnce(
    jetways,
    '  addInstances(THREE, group, box, materials.shell, transforms.wallCollar, "AIR_Jetway01_WallCollars");',
    `  addInstances(THREE, group, box, materials.facadeWall, transforms.facadeInfill, "Terminal4_LowerFacadeInfillPanels");\n  addInstances(THREE, group, box, materials.facadeDoor, transforms.facadeDoor, "Terminal4_ClosedServiceDoors");\n  addInstances(THREE, group, box, materials.facadeVent, transforms.facadeVent, "Terminal4_FacadeVentGrilles");\n  addInstances(THREE, group, box, materials.shell, transforms.wallCollar, "AIR_Jetway01_WallCollars");`,
    "facade mesh installation",
  );
}

if (!jetways.includes("group.userData.facadeInfillCount")) {
  jetways = replaceOnce(
    jetways,
    "  group.userData.a1TerminalWallDistance = a1TerminalWallDistance;",
    `  group.userData.a1TerminalWallDistance = a1TerminalWallDistance;\n  group.userData.facadeInfillCount = terminal4FacadeInfillCount;\n  group.userData.openServiceBayCount = OPEN_SERVICE_BAY_GATES.size;\n  group.userData.facadeInfillAuthority = "source-positioned-gate-module-closures-with-limited-service-openings";`,
    "facade runtime evidence",
  );
}

fs.writeFileSync(jetwayPath, jetways, "utf8");

const terminalPath = "src/environment/authoredTerminal4Visual.js";
let terminal = fs.readFileSync(terminalPath, "utf8");
if (!terminal.includes("authoredTerminal4FacadeInfillCount")) {
  terminal = replaceOnce(
    terminal,
    "  environment.userData.authoredTerminal4A1JetwayWallDistance = sourcePlacedJetways.userData.a1TerminalWallDistance;",
    `  environment.userData.authoredTerminal4A1JetwayWallDistance = sourcePlacedJetways.userData.a1TerminalWallDistance;\n  environment.userData.authoredTerminal4FacadeInfillCount = sourcePlacedJetways.userData.facadeInfillCount;\n  environment.userData.authoredTerminal4OpenServiceBayCount = sourcePlacedJetways.userData.openServiceBayCount;\n  environment.userData.authoredTerminal4FacadeInfillAuthority = sourcePlacedJetways.userData.facadeInfillAuthority;`,
    "Terminal 4 facade evidence propagation",
  );
}
fs.writeFileSync(terminalPath, terminal, "utf8");

const runtimePath = "scripts/prepare-terminal4-runtime.mjs";
let runtime = fs.readFileSync(runtimePath, "utf8");
if (!runtime.includes('dataset.terminal4FacadeInfillCount = "loading"')) {
  runtime = replaceOnce(
    runtime,
    '    renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "loading";',
    `    renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "loading";\n    renderer.domElement.dataset.terminal4FacadeInfillCount = "loading";\n    renderer.domElement.dataset.terminal4OpenServiceBayCount = "loading";\n    renderer.domElement.dataset.terminal4JetwayDetailLevel = "loading";`,
    "runtime facade loading evidence",
  );
}
if (!runtime.includes("authoredTerminal4FacadeInfillCount ?? 0")) {
  runtime = replaceOnce(
    runtime,
    "        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = String(environment.userData.authoredTerminal4SourceCutoutMaterialCount ?? 0);",
    `        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = String(environment.userData.authoredTerminal4SourceCutoutMaterialCount ?? 0);\n        renderer.domElement.dataset.terminal4FacadeInfillCount = String(environment.userData.authoredTerminal4FacadeInfillCount ?? 0);\n        renderer.domElement.dataset.terminal4OpenServiceBayCount = String(environment.userData.authoredTerminal4OpenServiceBayCount ?? 0);\n        renderer.domElement.dataset.terminal4JetwayDetailLevel = environment.userData.authoredTerminal4JetwayDetailLevel || "missing";`,
    "runtime facade success evidence",
  );
}
if (!runtime.includes('dataset.terminal4FacadeInfillCount = "load-error"')) {
  runtime = replaceOnce(
    runtime,
    '        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "load-error";',
    `        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "load-error";\n        renderer.domElement.dataset.terminal4FacadeInfillCount = "load-error";\n        renderer.domElement.dataset.terminal4OpenServiceBayCount = "load-error";\n        renderer.domElement.dataset.terminal4JetwayDetailLevel = "load-error";`,
    "runtime facade failure evidence",
  );
}
fs.writeFileSync(runtimePath, runtime, "utf8");

const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
let verifier = fs.readFileSync(verifierPath, "utf8");
for (const [oldToken, newToken, label] of [
  ['detailLevel: "fsx-air-jetway01-faithful-articulated-v2"', 'detailLevel: "fsx-air-jetway01-crj-scale-articulated-v3"', "verifier jetway detail"],
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35", "verifier door longitudinal target"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35", "verifier door lateral target"],
  ["AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.78", "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.65", "verifier contact clearance"],
]) {
  verifier = replaceToken(verifier, oldToken, newToken, label);
}
if (!verifier.includes('"Terminal4_LowerFacadeInfillPanels"')) {
  verifier = replaceOnce(
    verifier,
    '  "proceduralBuildingBoxReuse = false",',
    `  "proceduralBuildingBoxReuse = false",\n  "Terminal4_LowerFacadeInfillPanels",\n  "Terminal4_ClosedServiceDoors",\n  "OPEN_SERVICE_BAY_GATES",\n  "facadeInfillCount",`,
    "facade verifier tokens",
  );
}
fs.writeFileSync(verifierPath, verifier, "utf8");

const browserPath = "tests/browser/kphx-ground-runtime.spec.js";
let browser = fs.readFileSync(browserPath, "utf8");
if (!browser.includes("terminal4FacadeInfillCount")) {
  browser = replaceOnce(
    browser,
    "  expect(Number(runtime.terminal4SourceCutoutMaterialCount)).toBeGreaterThan(0);",
    `  expect(Number(runtime.terminal4SourceCutoutMaterialCount)).toBeGreaterThan(0);\n  expect(Number(runtime.terminal4FacadeInfillCount)).toBeGreaterThan(45);\n  expect(Number(runtime.terminal4OpenServiceBayCount)).toBe(6);\n  expect(runtime.terminal4JetwayDetailLevel).toBe("fsx-air-jetway01-crj-scale-articulated-v3");`,
    "browser facade assertions",
  );
}
fs.writeFileSync(browserPath, browser, "utf8");

for (const [path, tokens] of Object.entries({
  [jetwayPath]: [
    'detailLevel: "fsx-air-jetway01-crj-scale-articulated-v3"',
    "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35",
    "createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28)",
    "Terminal4_LowerFacadeInfillPanels",
    "group.userData.facadeInfillCount",
  ],
  [terminalPath]: ["authoredTerminal4FacadeInfillCount", "authoredTerminal4OpenServiceBayCount"],
  [runtimePath]: ["terminal4FacadeInfillCount", "terminal4JetwayDetailLevel"],
  [verifierPath]: ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35", "Terminal4_LowerFacadeInfillPanels"],
  [browserPath]: ["terminal4FacadeInfillCount", "fsx-air-jetway01-crj-scale-articulated-v3"],
})) {
  const prepared = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!prepared.includes(token)) throw new Error(`${path}: simulator-quality jetway/facade preparation is missing ${token}`);
}

console.log("Prepared Terminal 4 simulator-scale jetways and lower-facade v3: CRJ-sized bridge geometry, aft door contact, limited service openings, and closed source-positioned gate modules.");
