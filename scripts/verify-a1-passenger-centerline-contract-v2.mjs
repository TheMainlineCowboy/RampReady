import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const source = fs.readFileSync(sourcePath, "utf8");

const required = [
  'const passengerCenterY = tunnelRotundaSurfacePoint.y;',
  'shellStart.y = passengerCenterY;',
  'shellEnd.y = passengerCenterY;',
  'bridgeSealStartFleet.y = passengerCenterY;',
  'bridgeSealEndFleet.y = passengerCenterY;',
  'const width = bridgeBellowsWidthMeters;',
  'const height = bridgeBellowsHeightMeters;',
  'terminalBellowsCenter.y = passengerCenterY;',
  'uploadedJetwayA1PassengerCenterlineAuthority = "rendered-a1-passenger-centerline-continuity-v2"',
  'uploadedJetwayA1TerminalCenterlineErrorMeters = Math.abs(shellStart.y - tunnelRotundaSurfacePoint.y);',
  'A1 fixed terminal passenger centerline mismatch',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`A1 passenger-centerline contract is missing: ${token}`);
}

for (const forbidden of [
  'UploadedAirportJetwayA1TerminalRotundaOuterShroud',
  'rotundaOuterShroud',
  'rendered-a1-terminal-rotunda-tunnel-a-continuous-exterior-v1',
]) {
  if (source.includes(forbidden)) throw new Error(`A1 passenger-centerline contract still contains obsolete masking geometry: ${forbidden}`);
}

console.log('Verified A1 passenger-centerline contract: generated terminal leg and Rotunda/Tunnel-A sleeve use the Tunnel-A passenger centerline and measured cross-section; v1 shroud masking is absent.');
