import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runtimePath = path.join(root, "src/components/RampReadyStandupTrainerTerminal4.jsx");
if (!fs.existsSync(runtimePath)) throw new Error("Prepared Terminal 4 runtime must exist before simulator-detail injection");

let source = fs.readFileSync(runtimePath, "utf8");
const importAnchor = 'import { installAuthoredKphxPhotoGround } from "../environment/authoredKphxPhotoGround.js";';
const detailImport = 'import { buildKphxSimulatorDetail } from "../environment/kphxSimulatorDetail.js";';
const environmentAnchor = "    const environment = buildGround(scene);";

if (!source.includes(importAnchor)) throw new Error("Source-authored PHX aerial import anchor is missing");
if (!source.includes(environmentAnchor)) throw new Error("Prepared PHX environment anchor is missing");

source = source.replace(importAnchor, `${importAnchor}\n${detailImport}`);
source = source.replace(
  environmentAnchor,
  `${environmentAnchor}
    const simulatorDetail = buildKphxSimulatorDetail(THREE);
    environment.add(simulatorDetail);
    renderer.domElement.dataset.simulatorDetailSource = simulatorDetail.userData.environmentSource;
    renderer.domElement.dataset.simulatorDetailLevel = simulatorDetail.userData.detailLevel;
    renderer.domElement.dataset.simulatorJetwayCount = String(simulatorDetail.userData.jetwayCount);
    renderer.domElement.dataset.a1FineDetailMeshes = String(simulatorDetail.userData.a1FineDetailMeshes);
    renderer.domElement.dataset.a1RampTextureResolution = String(simulatorDetail.userData.rampTextureResolution);
    renderer.domElement.dataset.a1RampCoverageMeters = simulatorDetail.userData.rampCoverageMeters.join(",");`,
);

for (const token of [
  detailImport,
  "buildKphxSimulatorDetail(THREE)",
  "dataset.simulatorDetailSource",
  "dataset.simulatorDetailLevel",
  "dataset.simulatorJetwayCount",
  "dataset.a1FineDetailMeshes",
  "dataset.a1RampTextureResolution",
  "dataset.a1RampCoverageMeters",
]) {
  if (!source.includes(token)) throw new Error(`Simulator-detail runtime injection failed: ${token}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Injected simulator-detail Gate A1 ramp and all Terminal 4 jetways into ${path.relative(root, runtimePath)}`);
