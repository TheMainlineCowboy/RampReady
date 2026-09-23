import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "src/components/RampReadyStandupTrainer.jsx");
const outputPath = path.join(root, "src/components/RampReadyStandupTrainerTerminal4.jsx");

const source = fs.readFileSync(sourcePath, "utf8");
const importAnchor = 'import { createProceduralLektroRig, validateTugRig } from "../tug/lektroRig.js";';
const equipmentImport = 'import { installRuntimeEquipmentVisual, supportsRuntimeEquipmentVisual } from "../tug/runtimeEquipmentVisual.js";';
const environmentImport = 'import { buildKphxExactLiveEnvironment as buildTerminal4RampEnvironment, installKphxExactLiveTerminal4 as installAuthoredTerminal4Visual } from "../environment/kphxFullAirport/installLiveTerminal4Exact.js";';
const authoredEnvironmentImport = 'import { installKphxPackageOwnedObjectLayer } from "../environment/kphxFullAirport/installPackageOwnedObjectLayer.js";\nimport { KPHX_EXACT_RECOVERED_ASSETS } from "../environment/kphxFullAirport/exactAssetCatalog.js";';
const exactSurfaceImport = 'import { installKphxPackageOwnedSurfaceLayer } from "../environment/kphxFullAirport/installPackageOwnedSurfaceLayer.js";';
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
  `${importAnchor}\n${equipmentImport}\n${environmentImport}\n${authoredEnvironmentImport}\n${exactSurfaceImport}`,
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
        renderer.domElement.dataset.kphxExactLiveT4 = "ready";
        renderer.domElement.dataset.kphxExactLiveT4BuildingCount = String(environment.userData.exactLiveT4BuildingCount ?? 0);
        renderer.domElement.dataset.kphxExactLiveT4JetwayCount = String(environment.userData.exactLiveT4JetwayCount ?? 0);
        renderer.domElement.dataset.kphxExactLiveT4JetwayOpenEdgeCount = String(environment.userData.exactLiveT4JetwayOpenEdgeCount ?? 0);
        renderer.domElement.dataset.kphxExactLiveOldAirportJetwayGlbUsed = String(environment.userData.exactLiveOldAirportJetwayGlbUsed === true);
        renderer.domElement.dataset.kphxExactLiveProceduralTerminalMassing = String(environment.userData.proceduralTerminalMassing === true);
        renderer.domElement.dataset.kphxExactLiveLegacyFsxTerminal = String(environment.userData.legacyFsxTerminal === true);
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
        renderer.domElement.dataset.kphxExactLiveT4 = "load-error";
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
    const packageObjectLoad = terminalLoad
      .then(() => installKphxPackageOwnedObjectLayer(THREE, environment, {
        strict: true,
        excludeResources: Object.keys(KPHX_EXACT_RECOVERED_ASSETS.singleResourceAssets),
      }))
      .then((result) => {
        renderer.domElement.dataset.kphxPackageObjectPlacements = String(result.layer.userData.loadedPlacementCount);
        renderer.domElement.dataset.kphxPackageObjectResources = String(result.layer.userData.loadedUniqueAssetCount);
        return result;
      })
      .catch((error) => {
        renderer.domElement.dataset.kphxPackageObjectPlacements = "load-error";
        renderer.domElement.dataset.kphxPackageObjectResources = "load-error";
        console.error("RampReady KPHX package object layer failed", error);
        setMessage(`PHX package object layer failed to load: ${error.message}`);
        throw error;
      });
    const surfaceLoad = installKphxPackageOwnedSurfaceLayer(THREE, environment, { strict: true })
      .then((result) => {
        const data = result.layer.userData;
        renderer.domElement.dataset.groundSource = "KPHX 1.75.1 exact WED package surfaces";
        renderer.domElement.dataset.kphxVersion = String(data.sourceVersion || "missing");
        renderer.domElement.dataset.kphxSurfaceReady = String(data.ready === true);
        renderer.domElement.dataset.kphxSurfacePolygonCount = String(data.polygonCount ?? 0);
        renderer.domElement.dataset.kphxSurfaceOrthophotoCount = String(data.drapedOrthophotoCount ?? 0);
        renderer.domElement.dataset.kphxSurfaceLineMeshCount = String(data.lineMeshCount ?? 0);
        renderer.domElement.dataset.kphxSurfaceMaterialCount = String(data.materialCount ?? 0);
        renderer.domElement.dataset.kphxSurfaceFailureCount = String((data.failures || []).length);
        renderer.domElement.dataset.photoGroundSource = "not-used-exact-kphx-1.75.1-only";
        return result;
      })
      .catch((error) => {
        renderer.domElement.dataset.groundSource = "load-error";
        renderer.domElement.dataset.kphxSurfaceReady = "false";
        renderer.domElement.dataset.kphxSurfaceFailureCount = "load-error";
        renderer.domElement.dataset.photoGroundSource = "not-used-exact-kphx-1.75.1-only";
        console.error("RampReady exact KPHX surface load failed", error);
        setMessage(`Exact PHX surface layer failed to load: ${error.message}`);
        throw error;
      });
    void Promise.all([terminalLoad, packageObjectLoad, surfaceLoad])
      .then(() => {
        renderer.domElement.dataset.environmentSource = environment.userData.environmentSource;
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
        wheelbase: rig.profile.wheelbase,
        freeMaxSpeed: rig.profile.freeMaxSpeed,
        towMaxSpeed: rig.profile.towMaxSpeed,
        maxSteerAngle: rig.profile.kinematicMaxSteerAngle,`,
  )
  .replace(
    "    rig.root.userData.equipmentId = equipmentId;",
    `    rig.root.userData.equipmentId = equipmentId;
    renderer.domElement.dataset.tugSource = equipmentId === "standup-tug" ? "loading" : "procedural-lektro";
    renderer.domElement.dataset.steeringMode = rig.profile.steeringMode;
    renderer.domElement.dataset.rigProfile = rig.profile.id;
    renderer.domElement.dataset.rigWheelbaseMeters = String(rig.profile.wheelbase);
    renderer.domElement.dataset.rigTurningRadiusMeters = String(rig.profile.turningRadius ?? "");
    renderer.domElement.dataset.rigFreeMaxSpeedMps = String(rig.profile.freeMaxSpeed ?? "");
    renderer.domElement.dataset.rigTowMaxSpeedMps = String(rig.profile.towMaxSpeed ?? "");
    renderer.domElement.dataset.rigKinematicMaxSteerDegrees = Number.isFinite(rig.profile.kinematicMaxSteerAngle)
      ? THREE.MathUtils.radToDeg(rig.profile.kinematicMaxSteerAngle).toFixed(3)
      : "";
    renderer.domElement.dataset.rigVisualMaxSteerDegrees = Number.isFinite(rig.profile.visualMaxSteerAngle)
      ? THREE.MathUtils.radToDeg(rig.profile.visualMaxSteerAngle).toFixed(3)
      : "";
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

if (!prepared.includes(exactSurfaceImport)) throw new Error("Exact KPHX surface loader import was not injected");
if (!prepared.includes('dataset.tugSource = equipmentId === "standup-tug" ? "loading" : "procedural-lektro"')) throw new Error("Runtime tug visual loader was not injected");
if (!prepared.includes('dataset.environmentSource = "loading-authored-phx-terminal4-textured"')) throw new Error("Textured authored PHX environment loading evidence was not injected");


if (!prepared.includes('dataset.terminal4TextureCount = String(environment.userData.authoredTerminal4TextureCount)')) throw new Error("Terminal 4 source texture evidence was not injected");
if (!prepared.includes('dataset.terminal4TexturedMaterialCount = String(environment.userData.authoredTerminal4TexturedMaterialCount)')) throw new Error("Terminal 4 material evidence was not injected");
if (!prepared.includes('dataset.terminal4Position = environment.userData.authoredTerminal4Position')) throw new Error("Exact Terminal 4 position evidence was not injected");
if (!prepared.includes('dataset.terminal4A1NearestGeometryMeters = environment.userData.authoredTerminal4A1NearestGeometryDistance')) throw new Error("A1-to-terminal clearance evidence was not injected");
if (!prepared.includes('dataset.terminal4Placement = environment.userData.authoredTerminal4Placement')) throw new Error("Source placement authority evidence was not injected");
if (!prepared.includes('dataset.b15CorridorMeters = environment.userData.trainingCorridor')) throw new Error("B15 corridor distance evidence was not injected");
if (!prepared.includes("installAuthoredTerminal4Visual(THREE, environment)")) throw new Error("Exact KPHX T4 live runtime loader was not connected");
if (!prepared.includes("installKphxPackageOwnedSurfaceLayer(THREE, environment")) throw new Error("Exact KPHX surface runtime loader was not connected");
if (!prepared.includes("installKphxPackageOwnedObjectLayer(THREE, environment")) throw new Error("Full KPHX package-owned object layer was not connected");
if (!prepared.includes("excludeResources: Object.keys(KPHX_EXACT_RECOVERED_ASSETS.singleResourceAssets)")) throw new Error("Recovered exact KPHX objects are not protected from duplicate loading");
if (!prepared.includes("Promise.all([terminalLoad, packageObjectLoad, surfaceLoad])")) throw new Error("Combined PHX exact object/surface readiness gate was not injected");

if (!prepared.includes("new THREE.PerspectiveCamera(58, 1, 0.1, 8000)")) throw new Error("Airport-wide camera far plane was not injected");
if (!prepared.includes("new THREE.Fog(0x9fc4e6, 2400, 6500)")) throw new Error("Airport-wide fog range was not injected");
if (!prepared.includes("yaw: -0.64")) throw new Error("Open-ramp chase camera yaw was not injected");
if (!prepared.includes("orbitRef.current.yaw = -0.64")) throw new Error("Open-ramp reset camera yaw was not injected");
if (!prepared.includes("dataset.steeringMode = rig.profile.steeringMode")) throw new Error("Runtime steering-mode evidence was not injected");
if (!prepared.includes('dataset.operatorControls = rig.root.userData.standupSteeringWheel')) throw new Error("Runtime operator-control evidence was not injected");
if (!prepared.includes("createProceduralLektroRig(THREE, equipmentId)")) throw new Error("Equipment-specific rig profile was not injected");
if (!prepared.includes("steeringMode: rig.profile.steeringMode")) throw new Error("Equipment-specific steering mode was not injected");
if (!prepared.includes("wheelbase: rig.profile.wheelbase")) throw new Error("Equipment-specific wheelbase was not injected");
if (!prepared.includes("freeMaxSpeed: rig.profile.freeMaxSpeed")) throw new Error("Equipment-specific free speed was not injected");
if (!prepared.includes("towMaxSpeed: rig.profile.towMaxSpeed")) throw new Error("Equipment-specific tow speed was not injected");
if (!prepared.includes("maxSteerAngle: rig.profile.kinematicMaxSteerAngle")) throw new Error("Equipment-specific turning limit was not injected");
if (!prepared.includes("const environment = buildGround(scene);")) throw new Error("Terminal 4 environment was not connected to the active scene");
if (!prepared.includes("camera, environment, rig")) throw new Error("Environment reference was not retained by simulator state");
if (prepared.includes("new THREE.PlaneGeometry(90, 140)")) throw new Error("Legacy flat ramp geometry remains in active generated trainer");

const banner = "// GENERATED by scripts/prepare-terminal4-runtime.mjs. Do not edit directly.\n";
fs.writeFileSync(outputPath, banner + prepared, "utf8");
console.log(`Prepared active trainer with exact KPHX 1.75.1 terminal, jetway, package-object, WED-surface and equipment routing: ${path.relative(root, outputPath)}`);
