import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-tunnel-c-support-grounding-runtime-v19-primary-residual-visible-rods";
const oldImports = [
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV3.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV4.js";',
  'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV5.js";',
];
const newImport = 'import { groundA1TunnelCVisibleSupportHardwareV3 } from "../environment/a1TunnelCVisibleSupportGroundingV6.js";';
const callAnchor = "const finalA1VisibleSupportGrounding = groundA1TunnelCVisibleSupportHardwareV3(THREE, finalA1Model);";

let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(callAnchor)) {
  throw new Error(`${trainerPath}: V19 support wrapper cannot find the exact final A1 support call`);
}
if (!source.includes(newImport)) {
  const matches = oldImports.filter((entry) => source.includes(entry));
  if (matches.length !== 1) {
    throw new Error(`${trainerPath}: expected exactly one V3/V4/V5 support import before V19 replacement, found ${matches.length}`);
  }
  source = source.replace(matches[0], `${newImport}\n// ${marker}`);
}
if (!source.includes(marker)) source = source.replace(newImport, `${newImport}\n// ${marker}`);
fs.writeFileSync(trainerPath, source, "utf8");

source = fs.readFileSync(trainerPath, "utf8");
for (const required of [newImport, marker, callAnchor]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: V19 support wrapper missing ${required}`);
}
for (const stale of oldImports) {
  if (source.includes(stale)) throw new Error(`${trainerPath}: stale direct support import survived V19 wrapper: ${stale}`);
}
console.log(`Prepared ${marker}: exact A1 support runtime now runs the proven V3 identity pass, V4/V5 remaining rendered-mesh correction and telemetry normalization, then a final post-identity scan that grounds residual visible rods on Tunnel_C_Jetway_0 itself.`);
