import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-tunnel-c-support-grounding-runtime-v29-final-world-rod-diagnostic";
const oldImports = Array.from({length:13},(_,i)=>`import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV${i+3}.js";`);
const newImport = 'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV16.js";';
const callAnchor = "const finalA1VisibleSupportGrounding = groundA1TunnelCVisibleSupportHardwareV3(THREE, finalA1Model);";
let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(callAnchor)) throw new Error(`${trainerPath}: V29 cannot find final A1 support call`);
if (!source.includes(newImport)) {
  const matches = oldImports.filter((entry) => source.includes(entry));
  if (matches.length !== 1) throw new Error(`${trainerPath}: expected exactly one prior support import, found ${matches.length}`);
  source = source.replace(matches[0], `${newImport}\n// ${marker}`);
}
if (!source.includes(marker)) source = source.replace(newImport, `${newImport}\n// ${marker}`);
fs.writeFileSync(trainerPath, source, "utf8");
source = fs.readFileSync(trainerPath, "utf8");
for (const required of [newImport, marker, callAnchor]) if (!source.includes(required)) throw new Error(`${trainerPath}: V29 missing ${required}`);
for (const stale of oldImports) if (source.includes(stale)) throw new Error(`${trainerPath}: stale support import survived V29: ${stale}`);
console.log(`Prepared ${marker}: current final-world Tunnel-B/C narrow support components will be reported against rendered KPHX pavement.`);
