import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "src/components/RampReadyStandupTrainer.jsx");
const outputPath = path.join(root, "src/components/RampReadyStandupTrainerTerminal4.jsx");

const source = fs.readFileSync(sourcePath, "utf8");
const importAnchor = 'import { createProceduralLektroRig, validateTugRig } from "../tug/lektroRig.js";';
const equipmentImport = 'import { installRuntimeEquipmentVisual, supportsRuntimeEquipmentVisual } from "../tug/runtimeEquipmentVisual.js";';
const environmentImport = 'import { buildTerminal4RampEnvironment } from "../environment/terminal4RampEnvironment.js";';
const authoredEnvironmentImport = 'import { installAuthoredTerminal4Visual } from "../environment/authoredTerminal4Visual.js";';
const authoredGroundImport = 'import { installAuthoredKphxGround } from "../environment/authoredKphxGround.js";';
const groundStart = source.indexOf("function buildGround(scene) {");
const groundEndMarker = "\nfunction connectionMetrics(sim)";
const groundEnd = source.indexOf(groundEndMarker, groundStart);

if (!source.includes(importAnchor)) throw new Error("Stand-up tug import anchor not found in active trainer source");
if (groundStart < 0 || groundEnd < 0) throw new Error("Legacy buildGround block not found in active trainer source");
if (!source.includes("    buildGround(scene);")) throw new Error("Legacy buildGround call not found in active trainer source");
if (!source.includes("    const rig = createProceduralLektroRig(THREE);")) throw new Error("Equipment rig creation anchor not found");
if (!source.includes("        cradleOffset: rig.profile.cradleOffset,")) throw new Error("Pushback dynamics profile anchor not found");

const replacementGround = `function buildGround(scene) {
  const environment = buildTerminal4RampEnvironment(THREE);
  environment.position.set(0, 0, 0);
  scene.add(environment);
  return environment;
}`;

let prepared = source.replace(
  importAnchor,
  `${importAnchor}\n${equipmentImport}\n${environmentImport}\n${authoredEnvironmentImport}\n${authoredGroundImport}`,
);
const preparedGroundStart = prepared.indexOf("function buildGround(scene) {");
const preparedGroundEnd = prepared.indexOf(groundEndMarker, preparedGroundStart);
prepared = prepared.slice(0, preparedGroundStart) + replacementGround + prepared.slice(preparedGroundEnd);
prepared = prepared
  .replace(
    "    scene.fog = new THREE.Fog(0x9fc4e6, 70, 140);",
    "    scene.fog = new THREE.Fog(0x9fc4e6, 2400, 6500);",
  )
  .replace(
    "    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500);",
    "    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 8000);",
  )
  .replace(
    "    buildGround(scene);",
    `    const environment = buildGround(scene);
    renderer.domElement.dataset.environmentSource = "loading-authored-phx-terminal4";
    renderer.domElement.dataset.groundSource = "loading-authored-kphx-v181";
    renderer.domElement.dataset.kphxVersion = "loading";
    renderer.domElement.dataset.b15Anchors = "loading";
    const terminalLoad = installAuthoredTerminal4Visual(THREE, environment)
      .catch((error) => {
        console.error("RampReady PHX Terminal 4 visual load failed", error);
        setMessage(\`PHX Terminal 4 failed to load: \${error.message}\`);
        throw error;
      });
    const groundLoad = installAuthoredKphxGround(THREE, environment)
      .then((ground) => {
        renderer.domElement.dataset.groundSource = environment.userData.groundSource;
        renderer.domElement.dataset.kphxVersion = environment.userData.kphxVersion;
        renderer.domElement.dataset.sourceJetwayCount = String(environment.userData.sourceJetwayCount);
        renderer.domElement.dataset.terminal4JetwayCount = String(environment.userData.terminal4JetwayCount);
        renderer.domElement.dataset.terminal4ParkingCount = String(environment.userData.terminal4ParkingCount);
        renderer.domElement.dataset.b15Anchors = environment.userData.b15Anchors?.length === 2 ? "ready" : "missing";
        return ground;
      })
      .catch((error) => {
        renderer.domElement.dataset.groundSource = "load-error";
        renderer.domElement.dataset.b15Anchors = "load-error";
        console.error("RampReady KPHX ground load failed", error);
        setMessage(\`PHX airport ground failed to load: \${error.message}\`);
        throw error;
      });
    void Promise.all([terminalLoad, groundLoad])
      .then(() => {
        renderer.domElement.dataset.environmentSource = environment.userData.environmentSource;
        renderer.domElement.dataset.groundSource = environment.userData.groundSource;
      })
      .catch(() => {
        renderer.domElement.dataset.environmentSource = "load-error";
      });`,
  )
  .replace("    const rig = createProceduralLektroRig(THREE);", "    const rig = createProceduralLektroRig(THREE, equipmentId);")
  .replace(
    "const sim = { renderer, scene, camera, rig, aircraft,",
    "const sim = { renderer, scene, camera, environment, rig, aircraft,",
  )
  .replace(
    '    if (equipmentId !== "lektro-88") throw new Error(`Unsupported runtime equipment: ${equipmentId}`);',
    '    if (!supportsRuntimeEquipmentVisual(equipmentId)) throw new Error(`Unsupported runtime equipment: ${equipmentId}`);',
  )
  .replace(
    "        cradleOffset: rig.profile.cradleOffset,",
    `        cradleOffset: rig.profile.cradleOffset,
        steeringMode: rig.profile.steeringMode,
        wheelbase: rig.profile.wheelbase,`,
  )
  .replace(
    "    rig.root.userData.equipmentId = equipmentId;",
    `    rig.root.userData.equipmentId = equipmentId;
    renderer.domElement.dataset.tugSource = equipmentId === "standup-tug" ? "loading" : "procedural-lektro";
    renderer.domElement.dataset.steeringMode = rig.profile.steeringMode;
    renderer.domElement.dataset.operatorSide = rig.profile.operatorEye[0] > 0 ? "right" : "left";
    renderer.domElement.dataset.operatorControls = equipmentId === "standup-tug" ? "loading" : "not-applicable";
    void installRuntimeEquipmentVisual(rig, equipmentId)
      .then((source) => {
        renderer.domElement.dataset.tugSource = source;
        if (equipmentId === "standup-tug") {
          renderer.domElement.dataset.operatorControls = rig.root.userData.standupSteeringWheel && rig.root.userData.standupBatteryGauge ? "ready" : "missing";
        }
      })
      .catch((error) => {
        renderer.domElement.dataset.tugSource = "load-error";
        renderer.domElement.dataset.operatorControls = "load-error";
        console.error("RampReady equipment visual load failed", error);
        setMessage(\`Equipment model failed to load: \${error.message}\`);
      });`,
  );

if (!prepared.includes(authoredGroundImport)) throw new Error("Authored KPHX ground loader import was not injected");
if (!prepared.includes('dataset.tugSource = equipmentId === "standup-tug" ? "loading" : "procedural-lektro"')) throw new Error("Runtime tug visual loader was not injected");
if (!prepared.includes('dataset.environmentSource = "loading-authored-phx-terminal4"')) throw new Error("Authored PHX environment loading evidence was not injected");
if (!prepared.includes('dataset.groundSource = "loading-authored-kphx-v181"')) throw new Error("Updated KPHX loading evidence was not injected");
if (!prepared.includes("installAuthoredTerminal4Visual(THREE, environment)")) throw new Error("Authored PHX Terminal 4 runtime loader was not connected");
if (!prepared.includes("installAuthoredKphxGround(THREE, environment)")) throw new Error("Updated KPHX ground runtime loader was not connected");
if (!prepared.includes("Promise.all([terminalLoad, groundLoad])")) throw new Error("Combined PHX terminal/ground readiness gate was not injected");
if (!prepared.includes('dataset.b15Anchors = environment.userData.b15Anchors?.length === 2 ? "ready" : "missing"')) throw new Error("B15 runtime evidence was not injected");
if (!prepared.includes("new THREE.PerspectiveCamera(58, 1, 0.1, 8000)")) throw new Error("Airport-wide camera far plane was not injected");
if (!prepared.includes("new THREE.Fog(0x9fc4e6, 2400, 6500)")) throw new Error("Airport-wide fog range was not injected");
if (!prepared.includes("dataset.steeringMode = rig.profile.steeringMode")) throw new Error("Runtime steering-mode evidence was not injected");
if (!prepared.includes('dataset.operatorControls = rig.root.userData.standupSteeringWheel')) throw new Error("Runtime operator-control evidence was not injected");
if (!prepared.includes("createProceduralLektroRig(THREE, equipmentId)")) throw new Error("Equipment-specific rig profile was not injected");
if (!prepared.includes("steeringMode: rig.profile.steeringMode")) throw new Error("Equipment-specific steering mode was not injected");
if (!prepared.includes("wheelbase: rig.profile.wheelbase")) throw new Error("Equipment-specific wheelbase was not injected");
if (!prepared.includes("const environment = buildGround(scene);")) throw new Error("Terminal 4 environment was not connected to the active scene");
if (!prepared.includes("camera, environment, rig")) throw new Error("Environment reference was not retained by simulator state");
if (prepared.includes("new THREE.PlaneGeometry(90, 140)")) throw new Error("Legacy flat ramp geometry remains in active generated trainer");

const banner = "// GENERATED by scripts/prepare-terminal4-runtime.mjs. Do not edit directly.\n";
fs.writeFileSync(outputPath, banner + prepared, "utf8");
console.log(`Prepared active Terminal 4 trainer with updated KPHX 1.8.1 gates, airport-wide ground and equipment routing: ${path.relative(root, outputPath)}`);
