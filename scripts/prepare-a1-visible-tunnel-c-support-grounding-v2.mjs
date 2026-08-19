import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-tunnel-c-support-grounding-runtime-v30-final-world-exact-rods";
const oldImports = Array.from({length:14},(_,i)=>`import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV${i+3}.js";`);
const newImport = 'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV17.js";';
const callAnchor = "const finalA1VisibleSupportGrounding = groundA1TunnelCVisibleSupportHardwareV3(THREE, finalA1Model);";
let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(callAnchor)) throw new Error(`${trainerPath}: V30 cannot find final A1 support call`);
if (!source.includes(newImport)) {
  const matches = oldImports.filter((entry) => source.includes(entry));
  if (matches.length !== 1) throw new Error(`${trainerPath}: expected exactly one prior support import, found ${matches.length}`);
  source = source.replace(matches[0], `${newImport}\n// ${marker}`);
}
if (!source.includes(marker)) source = source.replace(newImport, `${newImport}\n// ${marker}`);
fs.writeFileSync(trainerPath, source, "utf8");
source = fs.readFileSync(trainerPath, "utf8");
for (const required of [newImport, marker, callAnchor]) if (!source.includes(required)) throw new Error(`${trainerPath}: V30 missing ${required}`);
for (const stale of oldImports) if (source.includes(stale)) throw new Error(`${trainerPath}: stale support import survived V30: ${stale}`);
console.log(`Prepared ${marker}: the exact current-world 63- and 45-triangle Tunnel-B support rods are telescoped to rendered KPHX pavement with fixed upper mounts.`);
