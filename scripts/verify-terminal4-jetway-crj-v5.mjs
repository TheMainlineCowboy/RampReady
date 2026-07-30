import fs from "node:fs";

const requireTokens = (path, tokens) => {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${path}: missing CRJ v5 token ${token}`);
  return source;
};

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const scriptName of ["materialize:phx-terminal4", "verify:kphx-v181", "prepare:terminal4-runtime"]) {
  const command = packageJson.scripts?.[scriptName] || "";
  if (!command.includes("prepare-terminal4-jetway-crj-v5.mjs")) throw new Error(`${scriptName} does not run the CRJ v5 jetway pass`);
  if (command.includes("prepare-terminal4-jetway-facade-v4.mjs")) throw new Error(`${scriptName} still runs the superseded v4 jetway pass`);
}
const runtimePreparation = packageJson.scripts?.["prepare:terminal4-runtime"] || "";
for (const token of ["prepare-terminal4-crj-runtime-evidence.mjs", "prepare-terminal4-inspection-controls.mjs"]) {
  if (!runtimePreparation.includes(token)) throw new Error(`Terminal 4 runtime does not apply ${token}`);
}

const jetways = requireTokens("src/environment/sourcePlacedTerminal4Jetways.js", [
  'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v5"',
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "const sourceFacadeRecessMeters",
  "CLOSED_SERVICE_DOOR_GATES.has(jetway.g)",
  "FACADE_VENT_GATES.has(jetway.g)",
  "createArchedTunnelGeometry(THREE, 2.18, 2.12, 0.24)",
  "createArchedTunnelGeometry(THREE, 1.96, 2.02, 0.2)",
  "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)",
  "group.userData.a1DoorContactErrorMeters",
]);
for (const forbidden of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "gateNumber % 3",
  "gateNumber % 2",
  "createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22)",
]) if (jetways.includes(forbidden)) throw new Error(`Superseded jetway implementation remains: ${forbidden}`);

requireTokens("src/environment/authoredTerminal4Visual.js", [
  "authoredTerminal4A1DoorContactErrorMeters",
  "sourcePlacedJetways.userData.a1DoorContactErrorMeters",
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
  'dataset.terminal4A1DoorContactErrorMeters = "loading"',
  "dataset.terminal4A1DoorContactErrorMeters = Number.isFinite",
  'dataset.terminal4A1DoorContactErrorMeters = "load-error"',
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

console.log("Terminal 4 CRJ v5 verified: CRJ-scale jetways, measured A1 browser contact evidence, source-qualified service bays, irregular lower facade, pavement-coincident markings, and visible free-drive inspection controls.");
