import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-tunnel-c-support-grounding-runtime-v26-actual-connected-support-diagnostic";
const oldImports = [
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV3.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV4.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV5.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV6.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV7.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV8.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV9.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV10.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV11.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV12.js";',
];
const newImport = 'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV13.js";';
const callAnchor = "const finalA1VisibleSupportGrounding = groundA1TunnelCVisibleSupportHardwareV3(THREE, finalA1Model);";
let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(callAnchor)) throw new Error(`${trainerPath}: V26 cannot find final A1 support call`);
if (!source.includes(newImport)) {
  const matches = oldImports.filter((entry) => source.includes(entry));
  if (matches.length !== 1) throw new Error(`${trainerPath}: expected exactly one prior support import, found ${matches.length}`);
  source = source.replace(matches[0], `${newImport}\n// ${marker}`);
}
if (!source.includes(marker)) source = source.replace(newImport, `${newImport}\n// ${marker}`);
fs.writeFileSync(trainerPath, source, "utf8");
source = fs.readFileSync(trainerPath, "utf8");
for (const required of [newImport, marker, callAnchor]) if (!source.includes(required)) throw new Error(`${trainerPath}: V26 missing ${required}`);
for (const stale of oldImports) if (source.includes(stale)) throw new Error(`${trainerPath}: stale support import survived V26: ${stale}`);
console.log(`Prepared ${marker}: after safe V11 isolation, actual rendered triangles on Tunnel B and Tunnel C are grouped by shared world-space vertices and remaining components in the aircraft-side support window are reported fail-closed.`);
