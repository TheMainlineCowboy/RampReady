import fs from "node:fs";
import {
  KPHX_T4_GATE_POSE_SOURCE,
  KPHX_T4_SUPPORTED_GATE_SCENARIO_POSES,
  KPHX_T4_SUPPORTED_RAMP_POSITION_IDS,
  KPHX_T4_UNMAPPED_RAMP_POSITIONS,
  createKphxTerminal4GateScenarioPose,
  getKphxTerminal4GatePoseByRampWedObjectId,
} from "../src/environment/kphxFullAirport/terminal4GatePoseAuthority.js";

const jetwayManifest = JSON.parse(
  fs.readFileSync("public/models/kphx/terminal4-wed-jetways.exact.json", "utf8"),
);
const placements = Array.isArray(jetwayManifest.placements) ? jetwayManifest.placements : [];
const failures = [];
const EPSILON = 1e-9;

function fail(message) {
  failures.push(message);
}

if (placements.length !== 76) fail(`live jetway placement count=${placements.length}, expected 76`);
if (KPHX_T4_SUPPORTED_RAMP_POSITION_IDS.length !== 76) {
  fail(`gate authority ramp-position count=${KPHX_T4_SUPPORTED_RAMP_POSITION_IDS.length}, expected 76`);
}
if (KPHX_T4_SUPPORTED_GATE_SCENARIO_POSES.length !== 76) {
  fail(`scenario-pose count=${KPHX_T4_SUPPORTED_GATE_SCENARIO_POSES.length}, expected 76`);
}
if (KPHX_T4_GATE_POSE_SOURCE.supportedGateNameCount !== 75) {
  fail(`supported gate-name count=${KPHX_T4_GATE_POSE_SOURCE.supportedGateNameCount}, expected 75`);
}

const manifestRampIds = placements.map((placement) => String(placement.rampWedObjectId));
const uniqueManifestRampIds = new Set(manifestRampIds);
if (uniqueManifestRampIds.size !== 76) fail(`unique live ramp-position IDs=${uniqueManifestRampIds.size}, expected 76`);

const authorityIds = new Set(KPHX_T4_SUPPORTED_RAMP_POSITION_IDS);
for (const id of manifestRampIds) if (!authorityIds.has(id)) fail(`live ramp WED object ${id} is missing from gate authority`);
for (const id of authorityIds) if (!uniqueManifestRampIds.has(id)) fail(`gate-authority WED object ${id} is not used by the live T4 jetway map`);

const rows = [];
for (const placement of placements) {
  const rampWedObjectId = String(placement.rampWedObjectId);
  const gatePose = getKphxTerminal4GatePoseByRampWedObjectId(rampWedObjectId);
  if (!gatePose) {
    fail(`missing pose for WED ramp object ${rampWedObjectId}`);
    continue;
  }

  if (gatePose.gate !== placement.gate) {
    fail(`gate mismatch for WED ${rampWedObjectId}: manifest=${placement.gate}, authority=${gatePose.gate}`);
  }
  if (!Number.isFinite(gatePose.sourceHeadingDegrees)) fail(`non-finite source heading for ${placement.gate}/${rampWedObjectId}`);
  if (!Number.isFinite(gatePose.runtimeYawRadians)) fail(`non-finite runtime yaw for ${placement.gate}/${rampWedObjectId}`);

  const scenario = createKphxTerminal4GateScenarioPose(rampWedObjectId);
  const dx = scenario.equipment.x - scenario.aircraft.x;
  const dz = scenario.equipment.z - scenario.aircraft.z;
  const actualOffset = Math.hypot(dx, dz);

  if (Math.abs(scenario.aircraft.yaw - scenario.equipment.yaw) > EPSILON) {
    fail(`aircraft/equipment yaw mismatch for ${placement.gate}/${rampWedObjectId}`);
  }
  if (Math.abs(actualOffset - scenario.equipmentApproachOffsetMeters) > 1e-6) {
    fail(`equipment offset mismatch for ${placement.gate}/${rampWedObjectId}: ${actualOffset}`);
  }
  if (scenario.authority !== "same-wed-ramp-position-aircraft-equipment-pose-v1") {
    fail(`shared scenario authority missing for ${placement.gate}/${rampWedObjectId}`);
  }

  rows.push({
    gate: placement.gate,
    rampWedObjectId,
    sourceHeadingDegrees: gatePose.sourceHeadingDegrees,
    runtimeYawDegrees: Number((gatePose.runtimeYawRadians * 180 / Math.PI).toFixed(2)),
    aircraft: {
      x: Number(scenario.aircraft.x.toFixed(6)),
      z: Number(scenario.aircraft.z.toFixed(6)),
      yawDegrees: Number((scenario.aircraft.yaw * 180 / Math.PI).toFixed(2)),
    },
    equipment: {
      x: Number(scenario.equipment.x.toFixed(6)),
      z: Number(scenario.equipment.z.toFixed(6)),
      yawDegrees: Number((scenario.equipment.yaw * 180 / Math.PI).toFixed(2)),
      approachOffsetMeters: Number(scenario.equipmentApproachOffsetMeters.toFixed(3)),
    },
  });
}

const gateCounts = new Map();
for (const row of rows) gateCounts.set(row.gate, (gateCounts.get(row.gate) || 0) + 1);
const duplicateGateNames = [...gateCounts.entries()]
  .filter(([, count]) => count > 1)
  .map(([gate, count]) => ({ gate, count }));

if (duplicateGateNames.length !== 1 || duplicateGateNames[0].gate !== "D7" || duplicateGateNames[0].count !== 2) {
  fail(`unexpected duplicate gate-name set: ${JSON.stringify(duplicateGateNames)}`);
}
if (KPHX_T4_UNMAPPED_RAMP_POSITIONS.length !== 8) {
  fail(`unmapped T4 WED ramp-position count=${KPHX_T4_UNMAPPED_RAMP_POSITIONS.length}, expected 8`);
}

const report = {
  schemaVersion: 1,
  status: failures.length ? "FAIL" : "PASS",
  authority: KPHX_T4_GATE_POSE_SOURCE,
  liveJetwayRampPositionCount: placements.length,
  uniqueLiveRampPositionCount: uniqueManifestRampIds.size,
  supportedGateNameCount: gateCounts.size,
  duplicateGateNames,
  unmappedRampPositionCount: KPHX_T4_UNMAPPED_RAMP_POSITIONS.length,
  sharedScenarioAuthority: "same-wed-ramp-position-aircraft-equipment-pose-v1",
  equipmentApproachOffsetMeters: 6.2,
  failures,
  gates: rows,
};

fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/kphx-t4-gate-heading-audit.json", JSON.stringify(report, null, 2) + "\n");

if (failures.length) {
  throw new Error(`KPHX T4 gate heading audit failed:\n- ${failures.join("\n- ")}`);
}

console.log(JSON.stringify({
  status: report.status,
  rampPositions: report.liveJetwayRampPositionCount,
  gateNames: report.supportedGateNameCount,
  duplicateGateNames: report.duplicateGateNames,
  sharedScenarioAuthority: report.sharedScenarioAuthority,
  equipmentApproachOffsetMeters: report.equipmentApproachOffsetMeters,
}, null, 2));
