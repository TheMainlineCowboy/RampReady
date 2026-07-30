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
const authoredPhotoGroundImport = 'import { installAuthoredKphxPhotoGround } from "../environment/authoredKphxPhotoGround.js";';
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
  `${importAnchor}\n${equipmentImport}\n${environmentImport}\n${authoredEnvironmentImport}\n${authoredGroundImport}\n${authoredPhotoGroundImport}`,
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
  .replace("    yaw: 2.5,", "    yaw: -0.64,")
  .replace("    orbitRef.current.yaw = 2.5;", "    orbitRef.current.yaw = -0.64;")
  .replace(
    "    buildGround(scene);",
    `    const environment = buildGround(scene);
    renderer.domElement.dataset.environmentSource = "loading-authored-phx-terminal4-textured";
    renderer.domElement.dataset.groundSource = "loading-authored-kphx-v181";
    renderer.domElement.dataset.photoGroundSource = "loading-source-authored-phx-photo";
    renderer.domElement.dataset.kphxVersion = "loading";
    renderer.domElement.dataset.kphxDetailLevel = "loading";
    renderer.domElement.dataset.photoDetailLevel = "loading";
    renderer.domElement.dataset.photoTileCount = "loading";
    renderer.domElement.dataset.photoWidth = "loading";
    renderer.domElement.dataset.photoHeight = "loading";
    renderer.domElement.dataset.photoBytes = "loading";
    renderer.domElement.dataset.hiddenAdexSurfaceMaterials = "loading";
    renderer.domElement.dataset.b15Anchors = "loading";
    renderer.domElement.dataset.b15CorridorMeters = "loading";
    renderer.domElement.dataset.terminal4TextureCount = "loading";
    renderer.domElement.dataset.terminal4ExactTextureCount = "loading";
    renderer.domElement.dataset.terminal4FallbackTextureCount = "loading";
    renderer.domElement.dataset.terminal4TexturedMaterialCount = "loading";
    renderer.domElement.dataset.terminal4Position = "loading";
    renderer.domElement.dataset.terminal4A1NearestGeometryMeters = "loading";
    renderer.domElement.dataset.terminal4Placement = "loading";
    renderer.domElement.dataset.terminal4A1JetwayWallDistance = "loading";
    renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount = "loading";
    renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "loading";
    renderer.domElement.dataset.terminal4FacadeInfillCount = "loading";
    renderer.domElement.dataset.terminal4OpenServiceBayCount = "loading";
    renderer.domElement.dataset.terminal4JetwayDetailLevel = "loading";
    renderer.domElement.dataset.terminal4LowerFacadeFitCount = "loading";
    renderer.domElement.dataset.terminal4JetwayTextureAuthority = "loading";
    renderer.domElement.dataset.terminal4ExactJetwayTextureActive = "loading";
    renderer.domElement.dataset.groundMarkingContactMode = "loading";
    const terminalLoad = installAuthoredTerminal4Visual(THREE, environment)
      .then((terminal) => {
        renderer.domElement.dataset.terminal4TextureCount = String(environment.userData.authoredTerminal4TextureCount);
        renderer.domElement.dataset.terminal4ExactTextureCount = String(environment.userData.authoredTerminal4ExactTextureCount);
        renderer.domElement.dataset.terminal4FallbackTextureCount = String(environment.userData.authoredTerminal4FallbackTextureCount);
        renderer.domElement.dataset.terminal4TexturedMaterialCount = String(environment.userData.authoredTerminal4TexturedMaterialCount);
        renderer.domElement.dataset.terminal4Position = environment.userData.authoredTerminal4Position.map((value) => value.toFixed(3)).join(",");
        renderer.domElement.dataset.terminal4A1NearestGeometryMeters = environment.userData.authoredTerminal4A1NearestGeometryDistance.toFixed(3);
        renderer.domElement.dataset.terminal4Placement = environment.userData.authoredTerminal4Placement;
        renderer.domElement.dataset.terminal4A1JetwayWallDistance = Number.isFinite(environment.userData.authoredTerminal4A1JetwayWallDistance)
          ? environment.userData.authoredTerminal4A1JetwayWallDistance.toFixed(3)
          : "missing";
        renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount = String(environment.userData.authoredTerminal4TerminalConnectedJetwayCount ?? 0);
        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = String(environment.userData.authoredTerminal4SourceCutoutMaterialCount ?? 0);
        renderer.domElement.dataset.terminal4FacadeInfillCount = String(environment.userData.authoredTerminal4FacadeInfillCount ?? 0);
        renderer.domElement.dataset.terminal4OpenServiceBayCount = String(environment.userData.authoredTerminal4OpenServiceBayCount ?? 0);
        renderer.domElement.dataset.terminal4JetwayDetailLevel = environment.userData.authoredTerminal4JetwayDetailLevel || "missing";
        renderer.domElement.dataset.terminal4LowerFacadeFitCount = String(environment.userData.authoredTerminal4LowerFacadeFitCount ?? 0);
        renderer.domElement.dataset.terminal4JetwayTextureAuthority = environment.userData.authoredTerminal4JetwayTextureAuthority || "missing";
        renderer.domElement.dataset.terminal4ExactJetwayTextureActive = String(environment.userData.authoredTerminal4ExactJetwayTextureActive === true);
        return terminal;
      })
      .catch((error) => {
        renderer.domElement.dataset.terminal4Position = "load-error";
        renderer.domElement.dataset.terminal4A1NearestGeometryMeters = "load-error";
        renderer.domElement.dataset.terminal4Placement = "load-error";
        renderer.domElement.dataset.terminal4A1JetwayWallDistance = "load-error";
        renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount = "load-error";
        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "load-error";
        renderer.domElement.dataset.terminal4FacadeInfillCount = "load-error";
        renderer.domElement.dataset.terminal4OpenServiceBayCount = "load-error";
        renderer.domElement.dataset.terminal4JetwayDetailLevel = "load-error";
        renderer.domElement.dataset.terminal4LowerFacadeFitCount = "load-error";
        renderer.domElement.dataset.terminal4JetwayTextureAuthority = "load-error";
        renderer.domElement.dataset.terminal4ExactJetwayTextureActive = "load-error";
        console.error("RampReady PHX Terminal 4 visual load failed", error);
        setMessage(\`PHX Terminal 4 failed to load: \${error.message}\`);
        throw error;
      });
    const groundLoad = installAuthoredKphxGround(THREE, environment)
      .then((ground) => {
        renderer.domElement.dataset.groundSource = environment.userData.groundSource;
        renderer.domElement.dataset.kphxVersion = environment.userData.kphxVersion;
        renderer.domElement.dataset.kphxDetailLevel = environment.userData.kphxDetailLevel;
        renderer.domElement.dataset.sourceJetwayCount = String(environment.userData.sourceJetwayCount);
        renderer.domElement.dataset.terminal4JetwayCount = String(environment.userData.terminal4JetwayCount);
        renderer.domElement.dataset.terminal4ParkingCount = String(environment.userData.terminal4ParkingCount);
        renderer.domElement.dataset.b15Anchors = environment.userData.b15Anchors?.length === 2 ? "ready" : "missing";
        renderer.domElement.dataset.b15CorridorMeters = environment.userData.trainingCorridor?.distanceMeters?.map((value) => Math.round(value)).join(",") || "missing";
        renderer.domElement.dataset.groundMarkingContactMode = environment.userData.authoredGroundMarkingContactMode || "missing";
        return ground;
      })
      .catch((error) => {
        renderer.domElement.dataset.groundSource = "load-error";
        renderer.domElement.dataset.kphxDetailLevel = "load-error";
        renderer.domElement.dataset.b15Anchors = "load-error";
        renderer.domElement.dataset.b15CorridorMeters = "load-error";
        renderer.domElement.dataset.groundMarkingContactMode = "load-error";
        console.error("RampReady KPHX ground load failed", error);
        setMessage(\`PHX airport ground failed to load: \${error.message}\`);
        throw error;
      });
    const photoGroundLoad = groundLoad
      .then(() => installAuthoredKphxPhotoGround(THREE, environment))
      .then((photoGround) => {
        renderer.domElement.dataset.photoGroundSource = environment.userData.photoGroundSource;
        renderer.domElement.dataset.photoDetailLevel = environment.userData.authoredPhotoDetailLevel;
        renderer.domElement.dataset.photoTileCount = String(environment.userData.authoredPhotoTileCount);
        renderer.domElement.dataset.photoWidth = String(environment.userData.authoredPhotoWidth);
        renderer.domElement.dataset.photoHeight = String(environment.userData.authoredPhotoHeight);
        renderer.domElement.dataset.photoBytes = String(environment.userData.authoredPhotoBytes);
        renderer.domElement.dataset.hiddenAdexSurfaceMaterials = String(environment.userData.hiddenADEXSurfaceMaterialCount);
        return photoGround;
      })
      .catch((error) => {
        renderer.domElement.dataset.photoGroundSource = "load-error";
        renderer.domElement.dataset.photoDetailLevel = "load-error";
        renderer.domElement.dataset.photoTileCount = "load-error";
        renderer.domElement.dataset.photoWidth = "load-error";
        renderer.domElement.dataset.photoHeight = "load-error";
        renderer.domElement.dataset.photoBytes = "load-error";
        renderer.domElement.dataset.hiddenAdexSurfaceMaterials = "load-error";
        console.error("RampReady PHX source aerial load failed", error);
        setMessage(\`PHX source aerial failed to load: \${error.message}\`);
        throw error;
      });
    void Promise.all([terminalLoad, groundLoad, photoGroundLoad])
      .then(() => {
        renderer.domElement.dataset.environmentSource = environment.userData.environmentSource;
        renderer.domElement.dataset.groundSource = environment.userData.groundSource;
        renderer.domElement.dataset.photoGroundSource = environment.userData.photoGroundSource;
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
if (!prepared.includes(authoredPhotoGroundImport)) throw new Error("Source-authored KPHX aerial loader import was not injected");
if (!prepared.includes('dataset.tugSource = equipmentId === "standup-tug" ? "loading" : "procedural-lektro"')) throw new Error("Runtime tug visual loader was not injected");
if (!prepared.includes('dataset.environmentSource = "loading-authored-phx-terminal4-textured"')) throw new Error("Textured authored PHX environment loading evidence was not injected");
if (!prepared.includes('dataset.groundSource = "loading-authored-kphx-v181"')) throw new Error("Updated KPHX loading evidence was not injected");
if (!prepared.includes('dataset.photoGroundSource = "loading-source-authored-phx-photo"')) throw new Error("Full-airport PHX aerial loading evidence was not injected");
if (!prepared.includes('dataset.kphxDetailLevel = environment.userData.kphxDetailLevel')) throw new Error("Authored KPHX detail evidence was not injected");
if (!prepared.includes('dataset.photoDetailLevel = environment.userData.authoredPhotoDetailLevel')) throw new Error("PHX aerial detail evidence was not injected");
if (!prepared.includes('dataset.photoTileCount = String(environment.userData.authoredPhotoTileCount)')) throw new Error("PHX aerial tile evidence was not injected");
if (!prepared.includes('dataset.hiddenAdexSurfaceMaterials = String(environment.userData.hiddenADEXSurfaceMaterialCount)')) throw new Error("ADEX surface replacement evidence was not injected");
if (!prepared.includes('dataset.terminal4TextureCount = String(environment.userData.authoredTerminal4TextureCount)')) throw new Error("Terminal 4 source texture evidence was not injected");
if (!prepared.includes('dataset.terminal4TexturedMaterialCount = String(environment.userData.authoredTerminal4TexturedMaterialCount)')) throw new Error("Terminal 4 material evidence was not injected");
if (!prepared.includes('dataset.terminal4Position = environment.userData.authoredTerminal4Position')) throw new Error("Exact Terminal 4 position evidence was not injected");
if (!prepared.includes('dataset.terminal4A1NearestGeometryMeters = environment.userData.authoredTerminal4A1NearestGeometryDistance')) throw new Error("A1-to-terminal clearance evidence was not injected");
if (!prepared.includes('dataset.terminal4Placement = environment.userData.authoredTerminal4Placement')) throw new Error("Source placement authority evidence was not injected");
if (!prepared.includes('dataset.b15CorridorMeters = environment.userData.trainingCorridor')) throw new Error("B15 corridor distance evidence was not injected");
if (!prepared.includes("installAuthoredTerminal4Visual(THREE, environment)")) throw new Error("Authored PHX Terminal 4 runtime loader was not connected");
if (!prepared.includes("installAuthoredKphxGround(THREE, environment)")) throw new Error("Updated KPHX ground runtime loader was not connected");
if (!prepared.includes("installAuthoredKphxPhotoGround(THREE, environment)")) throw new Error("Full-airport PHX aerial runtime loader was not connected");
if (!prepared.includes("Promise.all([terminalLoad, groundLoad, photoGroundLoad])")) throw new Error("Combined PHX terminal/ground/aerial readiness gate was not injected");
if (!prepared.includes('dataset.b15Anchors = environment.userData.b15Anchors?.length === 2 ? "ready" : "missing"')) throw new Error("B15 runtime evidence was not injected");
if (!prepared.includes("new THREE.PerspectiveCamera(58, 1, 0.1, 8000)")) throw new Error("Airport-wide camera far plane was not injected");
if (!prepared.includes("new THREE.Fog(0x9fc4e6, 2400, 6500)")) throw new Error("Airport-wide fog range was not injected");
if (!prepared.includes("yaw: -0.64")) throw new Error("Open-ramp chase camera yaw was not injected");
if (!prepared.includes("orbitRef.current.yaw = -0.64")) throw new Error("Open-ramp reset camera yaw was not injected");
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
console.log(`Prepared active trainer with the source-authored textured PHX Terminal 4, full-airport source aerial, exact ADEX A1 registration, unrotated airport ground and equipment routing: ${path.relative(root, outputPath)}`);
