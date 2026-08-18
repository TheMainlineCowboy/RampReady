import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-tunnel-c-support-grounding-runtime-v18-post-v4-complete-telemetry";
const oldImport = 'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV3.js";';
const v4Import = 'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV4.js";';
const newImport = 'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV5.js";';
const callAnchor = "const finalA1VisibleSupportGrounding = groundA1TunnelCVisibleSupportHardwareV3(THREE, finalA1Model);";

let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(callAnchor)) {
  throw new Error(`${trainerPath}: V18 support wrapper cannot find the exact final A1 support call`);
}
if (!source.includes(newImport)) {
  const oldCount = source.split(oldImport).length - 1;
  const v4Count = source.split(v4Import).length - 1;
  if (oldCount + v4Count !== 1) {
    throw new Error(`${trainerPath}: expected exactly one V3/V4 support import before V18 replacement, found V3=${oldCount} V4=${v4Count}`);
  }
  source = source.replace(oldCount === 1 ? oldImport : v4Import, `${newImport}\n// ${marker}`);
}
if (!source.includes(marker)) {
  source = source.replace(newImport, `${newImport}\n// ${marker}`);
}
fs.writeFileSync(trainerPath, source, "utf8");

source = fs.readFileSync(trainerPath, "utf8");
for (const required of [newImport, marker, callAnchor]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: V18 support wrapper missing ${required}`);
}
if (source.includes(oldImport) || source.includes(v4Import)) {
  throw new Error(`${trainerPath}: stale direct V3/V4 support import survived V18 wrapper`);
}
console.log(`Prepared ${marker}: exact A1 support runtime runs V3, the V4 remaining-visible-rod correction, then republishes complete corrected support counts for the unchanged strict runtime verifier.`);
