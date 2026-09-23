import fs from "node:fs";
import crypto from "node:crypto";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function sha256(path) {
  return crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
}

const live = readJson("reports/kphx-exact-live-a1.json");
const pass = readJson("reports/kphx-exact-live-a1-pass.json");
const texture = readJson("reports/kphx-t4-texture-pixel-verification.json");
const shell = readJson("reports/kphx-t4-building-shell-lock.json");
const lektro = readJson("public/models/lektro-88/current.json");
const zdp = readJson("public/models/kphx-full-airport/t4-a1-zdp-surfaces/manifest.json");
const kubota = readJson("reports/manager-kubota-exact-verification.json");
const d = live.state?.dataset || {};

assert(pass.status === "PASS", "Live A1 evidence is not PASS");
assert(live.navigationError == null && live.waitError == null, "Live A1 browser navigation/wait failed");
assert((live.pageErrors || []).length === 0, "Live A1 has page errors");
assert((live.failedRequests || []).length === 0, "Live A1 has failed requests");
assert((live.httpErrors || []).length === 0, "Live A1 has HTTP errors");

const expectedDataset = {
  kphxExactLiveT4: "ready",
  kphxExactLiveT4BuildingCount: "2",
  kphxExactLiveT4JetwayCount: "76",
  kphxExactLiveT4JetwayOpenEdgeCount: "261",
  kphxExactLiveOldAirportJetwayGlbUsed: "false",
  kphxExactLiveProceduralTerminalMassing: "false",
  kphxExactLiveLegacyFsxTerminal: "false",
  terminal4ExactJetwayTextureActive: "true",
  tugSource: "lektro-ap88-tvo914-r187a",
  rigProfile: "lektro-ap88-tvo914-r187a",
  rigWheelbaseMeters: "2.33934",
  rigTurningRadiusMeters: "4.572",
  rigFreeMaxSpeedMps: "4.02336",
  rigTowMaxSpeedMps: "1.78816",
  rigVisualMaxSteerDegrees: "84.000",
  kphxSurfaceReady: "true",
  kphxSurfacePolygonCount: "27",
  kphxSurfaceFailureCount: "0",
  kphxA1ZdpSurfaceReady: "true",
  kphxA1ZdpSurfacePolygonCount: "14",
  kphxA1ZdpMarkingsReady: "true",
  kphxA1ZdpMarkingLineMeshCount: "26",
  kphxA1ZdpMarkingTextureDecodeCount: "4",
  kphxA1ZdpMarkingFailureCount: "0",
  kphxTransparentConcreteUnderlayCount: "8",
  photoGroundSource: "not-used-exact-kphx-1.75.1-only",
};
for (const [key, expected] of Object.entries(expectedDataset)) {
  assert(String(d[key]) === expected, `Live A1 dataset drift: ${key}=${d[key]} expected ${expected}`);
}

assert(shell.status === "PASS", "T4 building shell lock is not PASS");
assert(shell.buildings?.length === 2, "T4 building shell lock must contain exactly two buildings");
assert(shell.lockedJetwayContext?.jetwayCount === 76, "T4 shell lock jetway count drifted");
assert(shell.lockedJetwayContext?.authoredOpenEdges === 261, "T4 shell lock authored edge count drifted");
assert(shell.lockedJetwayContext?.modifiedDuringBuildingPass === false, "T4 shell pass modified jetways");

for (const building of shell.buildings) {
  const runtimePath = building.runtimeAsset.replace(/^\//, "public/");
  assert(fs.existsSync(runtimePath), `Missing exact T4 runtime asset: ${runtimePath}`);
  assert(sha256(runtimePath) === building.runtimeSha256, `Exact T4 runtime hash drifted: ${runtimePath}`);
  assert(building.decodedDayTextureExact === true && building.decodedLitTextureExact === true,
    `Exact T4 decoded texture lock missing for ${building.resource}`);
}

assert(texture.targets?.length === 2, "T4 texture verification must contain two targets");
for (const target of texture.targets) {
  assert(target.allSourceRawHashesMatchAuthority === true, `${target.name} source texture hash drifted`);
  assert(target.allDecodedSizesMatch === true, `${target.name} decoded texture size drifted`);
  assert(target.allDecodedRgbaMatchSource === true, `${target.name} decoded RGBA drifted`);
  for (const image of target.textures || []) {
    assert(image.sourceRawHashMatchesAuthority === true, `${target.name}/${image.kind} source hash mismatch`);
    assert(image.decodedSizeMatches === true, `${target.name}/${image.kind} decoded size mismatch`);
    assert(image.decodedRgbaMatchesSource === true, `${target.name}/${image.kind} decoded pixels mismatch`);
  }
}

assert(lektro.status === "sim-ready-final" && lektro.revision === "R187A", "Final LEKTRO R187A lock missing");
assert(lektro.asset === "LEKTRO_AP88_TVO914.glb", "Final LEKTRO asset name drifted");
const lektroPath = `public/models/lektro-88/${lektro.asset}`;
assert(fs.existsSync(lektroPath), "Final LEKTRO GLB is missing");
assert(fs.statSync(lektroPath).size === lektro.bytes, "Final LEKTRO byte length drifted");
assert(sha256(lektroPath) === lektro.sha256, "Final LEKTRO SHA256 drifted");
assert(lektro.runtime?.rearSteer === true, "Final LEKTRO rear-steer authority drifted");
assert(lektro.runtime?.wheelbaseMeters === 2.33934, "Final LEKTRO wheelbase drifted");
assert(lektro.runtime?.turningRadiusMeters === 4.572, "Final LEKTRO turning radius drifted");
assert(lektro.runtime?.cradleLiftMeters === 0.2286, "Final LEKTRO cradle lift drifted");

const kubotaPath = "public/models/manager-kubota/RampReady-manager-Kubota-exact.glb";
assert(kubota.status === "PASS", "Exact manager Kubota verification is not PASS");
assert(kubota.runtimePath === "/models/manager-kubota/RampReady-manager-Kubota-exact.glb", "Manager Kubota runtime path drifted");
assert(kubota.bytes === 23988388, "Manager Kubota authority byte count drifted");
assert(kubota.sha256 === "726fdcb3511e6d52990da11118be4ca8a8b73c5d5c8f5bde4f934131e3c31b7d", "Manager Kubota authority SHA drifted");
assert(fs.existsSync(kubotaPath), "Exact manager Kubota GLB is missing");
assert(fs.statSync(kubotaPath).size === 23988388, "Exact manager Kubota byte length drifted");
assert(sha256(kubotaPath) === kubota.sha256, "Exact manager Kubota SHA256 drifted");

assert((zdp.failures || []).length === 0, "A1 ZDP surface manifest has failures");
assert(Object.keys(zdp.resources || {}).length === 14, "A1 ZDP exact resource count drifted");

const liveInstaller = fs.readFileSync("src/environment/kphxFullAirport/installLiveTerminal4Exact.js", "utf8");
assert(liveInstaller.includes('"Terminals/Terminal4.obj"'), "Live exact T4 south resource missing");
assert(liveInstaller.includes('"Terminals/Terminal4b.obj"'), "Live exact T4 north resource missing");
assert(liveInstaller.includes("installKphxTerminal4StockJetways"), "Live exact stock jetway installer missing");
assert(liveInstaller.includes("jetwayCount !== 76"), "Live exact jetway count guard missing");
assert(liveInstaller.includes("authoredOpenEdgeCount !== 261"), "Live exact jetway edge guard missing");
assert(liveInstaller.includes("exactLiveOldAirportJetwayGlbUsed: false"), "Old Airport_Jetway.glb exclusion guard missing");

const equipment = fs.readFileSync("src/tug/runtimeEquipmentVisual.js", "utf8");
assert(equipment.includes("LEKTRO_AP88_TVO914.glb"), "Live LEKTRO does not load finalized R187A GLB");
assert(equipment.includes('"lektro-ap88-tvo914-r187a"'), "Live LEKTRO finalized source label missing");
assert(equipment.includes("gltf.scene.rotation.y = Math.PI"), "Live LEKTRO 180-degree model-forward correction missing");
assert(equipment.includes("modelForwardCorrectionDegrees = 180"), "Live LEKTRO orientation evidence missing");
assert(equipment.includes("RampReady-manager-Kubota-exact.glb"), "Live manager Kubota exact GLB path missing");
assert(equipment.includes('"manager-kubota-exact"'), "Live manager Kubota exact source label missing");
assert(equipment.includes("AuthoredSteerPivot_L") && equipment.includes("AuthoredSteerPivot_R"), "Live manager Kubota steering pivot binding missing");

const trainer = fs.readFileSync("src/components/RampReadyStandupTrainerTerminal4.jsx", "utf8");
assert(trainer.includes("KPHX_INVISIBLE_CONCRETE_SOURCE_UNDERLAY"), "Transparent concrete source-compatible underlay missing");
assert(trainer.includes("ZDP_Library/ground_textures/concrete/flat/Flat_New_Uniform.pol"), "Exact A1 source concrete underlay authority missing");
assert(trainer.includes('A1_AIRCRAFT_HEADING_AUTHORITY = "KPHX-1.75.1-earth.wed.xml-WED_RampPosition-27855"'), "Exact A1 WED ramp-position heading authority missing");
assert(trainer.includes("const A1_GATE_POSE = getKphxTerminal4GatePoseByRampWedObjectId"), "A1 aircraft pose is not resolved from exact T4 gate authority");
assert(trainer.includes("A1_SOURCE_HEADING_DEGREES = A1_GATE_POSE.sourceHeadingDegrees"), "A1 aircraft heading is not derived from exact WED gate pose");
assert(trainer.includes("A1_AIRCRAFT_YAW_RADIANS = A1_GATE_POSE.runtimeYawRadians"), "A1 runtime yaw is not derived from exact WED gate pose");
assert(trainer.includes("aircraft.position.set(A1_AIRCRAFT_START_X, 0, NOSE_START_Z);"), "Initial A1 aircraft source position missing");
assert(trainer.includes("aircraft.rotation.y = A1_AIRCRAFT_YAW_RADIANS;"), "Initial A1 aircraft source yaw missing");
assert(trainer.includes("sim.aircraft.position.set(A1_AIRCRAFT_START_X, 0, NOSE_START_Z);"), "A1 aircraft reset source position missing");
assert(trainer.includes("sim.aircraft.rotation.y = A1_AIRCRAFT_YAW_RADIANS;"), "A1 aircraft reset source yaw missing");
assert(trainer.includes("sim.rig.root.position.set(A1_EQUIPMENT_SPAWN.x, 0, A1_EQUIPMENT_SPAWN.z);"), "A1 equipment reset source position missing");
assert(trainer.includes("sim.rig.root.rotation.y = A1_EQUIPMENT_SPAWN.yaw;"), "A1 equipment reset source yaw missing");
assert(trainer.includes("dynamics: createA1SpawnPushbackState()"), "A1 initial dynamics are not gate-pose aligned");
assert(!trainer.includes("sim.aircraft.rotation.y = 0;"), "Hard-coded zero A1 aircraft reset yaw remains");
assert(!trainer.includes("sim.rig.root.position.set(0, 0, 0);"), "Hard-coded zero A1 equipment reset position remains");
assert(!trainer.includes("sim.rig.root.rotation.y = 0;"), "Hard-coded zero A1 equipment reset yaw remains");
assert(trainer.includes('dataset.a1AircraftHeadingReady = "true"'), "A1 aircraft heading runtime evidence missing");
assert(trainer.includes('A1_EQUIPMENT_SPAWN_AUTHORITY = "same-a1-wed-gate-pose-equipment-spawn-v1"'), "A1 equipment spawn authority missing");
assert(trainer.includes("dataset.a1EquipmentSpawnAuthority = A1_EQUIPMENT_SPAWN_AUTHORITY"), "A1 equipment runtime evidence missing");

const kphxSourceAuthority = fs.readFileSync("src/environment/kphxFullAirport/sourceAuthority.js", "utf8");
assert(kphxSourceAuthority.includes('wedObjectId: "27855"'), "A1 source WED object drifted");
assert(kphxSourceAuthority.includes("headingDegrees: -90.08"), "A1 source WED heading drifted from -90.08 degrees");

const gatePoseAuthority = fs.readFileSync("src/environment/kphxFullAirport/terminal4GatePoseAuthority.js", "utf8");
assert(gatePoseAuthority.includes('sha256: "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498"'), "T4 gate-pose WED source hash drifted");
assert(gatePoseAuthority.includes("supportedRampPositionCount: 76"), "T4 supported ramp-position count drifted");
assert(gatePoseAuthority.includes("supportedGateNameCount: 75"), "T4 supported gate-name count drifted");
assert(gatePoseAuthority.includes('["A1",27855,33.436530675,-111.998921221,-90.08]'), "Exact A1 WED gate pose drifted");
assert(gatePoseAuthority.includes('["D7",106848') && gatePoseAuthority.includes('["D7",106850'), "Dual D7 ramp-position authority missing");

const exactGatePosePrep = fs.readFileSync("scripts/prepare-a1-exact-gate-pose-v1.mjs", "utf8");
assert(exactGatePosePrep.includes("same-a1-wed-gate-pose-equipment-spawn-v1"), "Final A1 exact gate-pose prep marker missing");
assert(exactGatePosePrep.includes("Stale A1 zero-pose reset survived"), "Final A1 exact gate-pose stale-reset guard missing");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const terminal4PrepareSteps = String(packageJson.scripts?.["prepare:terminal4-runtime"] || "").split(" && ");
assert(terminal4PrepareSteps.at(-1) === "node scripts/prepare-a1-exact-gate-pose-v1.mjs", "Exact A1 gate-pose enforcement is not the final Terminal 4 preparation step");

const launcher = fs.readFileSync("src/components/PushbackTrainer.jsx", "utf8");
assert(launcher.includes("total: 4"), "Four-stage preload screen contract missing");
assert(launcher.includes("kphxA1ZdpMarkingsReady"), "Preload screen does not wait for exact A1 markings");
assert(launcher.includes('"manager-kubota-exact"'), "Launcher does not wait for exact manager Kubota");
assert(launcher.includes('isEquipmentLaunchable(selectedEquipmentId, "training")'), "Launcher training-only availability guard missing");
assert(launcher.includes('isEquipmentLaunchable(selectedEquipmentId, "inspection")'), "Launcher inspection availability guard missing");

const equipmentProfiles = fs.readFileSync("src/config/equipmentProfiles.js", "utf8");
assert(equipmentProfiles.includes('id: "manager-kubota"'), "Manager Kubota equipment profile missing");
assert(equipmentProfiles.includes("trainingAvailable: false"), "Manager Kubota must remain inspection-only");
assert(equipmentProfiles.includes("inspectionAvailable: true"), "Manager Kubota inspection availability missing");

const tugRig = fs.readFileSync("src/tug/lektroRig.js", "utf8");
assert(tugRig.includes('id: "manager-kubota-exact"'), "Manager Kubota exact rig profile missing");
assert(tugRig.includes('steeringMode: "front"'), "Manager Kubota front-steer authority missing");
assert(tugRig.includes("wheelbase: 1.94"), "Manager Kubota wheelbase authority missing");

console.log(JSON.stringify({
  status: "PASS",
  authority: "current exact KPHX live Pages release gate",
  buildings: 2,
  jetways: 76,
  authoredOpenEdges: 261,
  pavementPolygons: 27,
  a1ZdpMarkingMeshes: 26,
  a1ZdpUniqueTextureDecodes: 4,
  transparentConcreteUnderlays: 8,
  supportedT4RampPositions: 76,
  supportedT4GateNames: 75,
  a1SourceHeadingDegrees: -90.08,
  a1EquipmentSpawnAuthority: "same-a1-wed-gate-pose-equipment-spawn-v1",
  lektroRevision: lektro.revision,
  lektroSha256: lektro.sha256,
  managerKubotaBytes: kubota.bytes,
  managerKubotaSha256: kubota.sha256,
  managerKubotaInspectionOnly: true,
  browserErrors: 0,
}, null, 2));
