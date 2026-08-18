import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-tunnel-c-support-grounding-runtime-v17-post-v3-visible-rods";
const oldImport = 'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV3.js";';
const newImport = 'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV4.js";';
const callAnchor = "const finalA1VisibleSupportGrounding = groundA1TunnelCVisibleSupportHardwareV3(THREE, finalA1Model);";

let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(callAnchor)) {
  throw new Error(`${trainerPath}: V17 support wrapper cannot find the exact final A1 support call`);
}
if (!source.includes(newImport)) {
  const count = source.split(oldImport).length - 1;
  if (count !== 1) {
    throw new Error(`${trainerPath}: expected exactly one V3 support import before V17 replacement, found ${count}`);
  }
  source = source.replace(oldImport, `${newImport}\n// ${marker}`);
}
if (!source.includes(marker)) {
  source = source.replace(newImport, `${newImport}\n// ${marker}`);
}
fs.writeFileSync(trainerPath, source, "utf8");

source = fs.readFileSync(trainerPath, "utf8");
for (const required of [newImport, marker, callAnchor]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: V17 support wrapper missing ${required}`);
}
if (source.includes(oldImport)) {
  throw new Error(`${trainerPath}: stale V3 direct support import survived V17 wrapper`);
}
console.log(`Prepared ${marker}: exact A1 support runtime now runs V3 plus a broader post-pass that grounds and re-verifies remaining visible vertical rod surfaces against rendered KPHX pavement.`);
