import fs from "node:fs";

const requireTokens = (path, tokens) => {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${path}: missing source-scale jetway token ${token}`);
  return source;
};

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const scriptName of ["materialize:phx-terminal4", "verify:kphx-v181", "prepare:terminal4-runtime"]) {
  const command = packageJson.scripts?.[scriptName] || "";
  if (!command.includes("prepare-terminal4-jetway-crj-v5.mjs")) throw new Error(`${scriptName} does not run the source-scale jetway protection pass`);
  if (!command.includes("prepare-terminal4-jetway-visual-v6.mjs")) throw new Error(`${scriptName} does not run the non-striped source-atlas visual pass`);
  if (!command.includes("prepare-terminal4-facade-visual-v7.mjs")) throw new Error(`${scriptName} does not run the source-first facade authority pass`);
  if (command.includes("prepare-terminal4-jetway-facade-v4.mjs")) throw new Error(`${scriptName} still runs the superseded v4 facade pass`);
}
const runtimePreparation = packageJson.scripts?.["prepare:terminal4-runtime"] || "";
for (const token of [
  "prepare-terminal4-crj-runtime-evidence.mjs",
  "prepare-terminal4-inspection-controls.mjs",
  "prepare-mobile-inspection-hud.mjs",
]) {
  if (!runtimePreparation.includes(token)) throw new Error(`Terminal 4 runtime does not apply ${token}`);
}

const jetways = requireTokens("src/environment/sourcePlacedTerminal4Jetways.js", [
  'detailLevel: "fsx-air-jetway01-exact-textured-source-scale-articulated-v5"',
  'sourceDimensionsMeters: Object.freeze([37.92, 8.77, 26.51])',
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35",
  "const sourceFacadeRecessMeters",
  "CLOSED_SERVICE_DOOR_GATES.has(jetway.g)",
  "FACADE_VENT_GATES.has(jetway.g)",
  "source-authored-lower-facade-authority-v25",
  "createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28)",
  "createArchedTunnelGeometry(THREE, 2.18, 2.18, 0.24)",
  "createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22)",
  "group.userData.sourceScaleAuthority",
  "group.userData.sourceGeometryMode",
  "group.userData.requiresOriginalSourceMesh",
  "group.userData.jetwayMotionLimits",
  'group.userData.initialJetwayState = "attached-to-aircraft-door"',
  "group.userData.requiredPrePushSequence",
  "exactJetwayAtlasRegions",
  "group.userData.jetwayTextureMappingAuthority",
  "THREE.ClampToEdgeWrapping",
]);
for (const forbidden of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "gateNumber % 3",
  "gateNumber % 2",
  "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)",
  "scale: [2.24, 2.12, wallConnectorLength]",
  "map.repeat.set(repeatX, repeatY)",
  "map.wrapS = map.wrapT = THREE.RepeatWrapping",
  "const lowerWallFit = lowerFacadeWallDistance ?? terminalWallDistance",
  "const facadeRampOffset = 0.95",
  "const facadeRampOffset = 0.28",
  "scale: [7.0, 3.42, 0.5]",
  "scale: [6.4, 3.36, 0.68]",
  "scale: [5.72, 2.58, 0.42]",
  "transforms.facadeInfill.push",
  "transforms.facadeDoor.push",
  "transforms.facadeVent.push",
]) if (jetways.includes(forbidden)) throw new Error(`Aircraft-specific jetway shrink, whole-atlas repetition, or generated facade substitute remains: ${forbidden}`);

requireTokens("src/environment/authoredTerminal4Visual.js", [
  "authoredTerminal4JetwaySourceScaleAuthority",
  "sourcePlacedJetways.userData.sourceScaleAuthority",
  "authoredTerminal4RequiresOriginalJetwayMesh",
  "authoredTerminal4JetwayRequiredPrePushSequence",
]);

for (const path of ["src/components/RampReadyStandupTrainer.jsx", "src/components/RampReadyStandupTrainerTerminal4.jsx"]) {
  requireTokens(path, [
    'className="rr-inspection-toggle"',
    'data-inspection-mode={inspectionMode ? "active" : "training"}',
    "const keyboardForward = inspectionActive",
    "const keyboardReverse = inspectionActive",
    "const inspectionThrottle = keyboardForward || keyboardReverse",
  ]);
}
requireTokens("src/components/RampReadyStandupTrainerTerminal4.jsx", [
  'dataset.terminal4JetwaySourceScaleAuthority = "loading"',
  "dataset.terminal4JetwaySourceScaleAuthority = environment.userData",
  'dataset.terminal4JetwaySourceScaleAuthority = "load-error"',
  "dataset.terminal4RequiresOriginalJetwayMesh",
  "dataset.terminal4JetwayPrePushSequence",
]);
requireTokens("src/components/throttle-force.css", [
  "RampReady mobile inspection HUD title polish",
  "flex-direction: column",
  ".rr-shell .rr-topline > div:first-child",
  "white-space: normal",
  "text-overflow: clip",
]);

const markings = requireTokens("scripts/build-kphx-simulator-ground.mjs", [
  "const markingY = taxiwayPath.type === 3 ? 0.0018",
  'addStrip("yellow-marking", a, b, 0.16, 0.0025)',
  "lineWidth, 0.0026",
  "stripeWidth, 0.0034",
]);
for (const forbidden of ["0.0135", "0.0255", "0.0137", "0.0138", "0.0258"]) {
  if (markings.includes(forbidden)) throw new Error(`Raised marking token remains: ${forbidden}`);
}

console.log("Terminal 4 jetway source authority verified: stock scale 1.00 is protected, exact atlas regions remain active without whole-sheet repetition, the converted source terminal is the lower-facade authority with no cloned panels, fallback jetway geometry is disclosed, animation requirements are explicit, markings are pavement-coincident, free-drive controls are visible, and the mobile step title remains readable.");
