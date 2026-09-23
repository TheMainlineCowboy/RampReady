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

const launcher = fs.readFileSync("src/components/PushbackTrainer.jsx", "utf8");
assert(launcher.includes("total: 4"), "Four-stage preload screen contract missing");
assert(launcher.includes("kphxA1ZdpMarkingsReady"), "Preload screen does not wait for exact A1 markings");

console.log(JSON.stringify({
  status: "PASS",
  authority: "current exact KPHX live Pages release gate",
  buildings: 2,
  jetways: 76,
  authoredOpenEdges: 261,
  pavementPolygons: 27,
  a1ZdpMarkingMeshes: 26,
  a1ZdpUniqueTextureDecodes: 4,
  lektroRevision: lektro.revision,
  lektroSha256: lektro.sha256,
  browserErrors: 0,
}, null, 2));
