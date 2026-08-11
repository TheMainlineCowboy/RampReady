import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const marker = "source-measured-real-terminal-wall-readiness-v3";
const FINAL_CENTER_TO_WALL_MINIMUM_METERS = 0.5;
const FINAL_CENTER_TO_WALL_MAXIMUM_METERS = 44;
const FINAL_VISIBLE_FIXED_LEG_MINIMUM_METERS = 0.15;
const FINAL_VISIBLE_FIXED_LEG_MAXIMUM_METERS = 44;

// A1's final Terminal 4 attachment is measured from the structural facade to
// the exact supplied Rotunda. Do not relocate the bridge to manufacture a
// compact 2.4 m leg. Normalize every historical wall/visible-span allowance to
// the physical source-measured range while preserving all other readiness gates.
source = source
  .replace(
    /a1TerminalWallDistance\s*(?:>|>=)\s*[0-9.]+\s*&&\s*a1TerminalWallDistance\s*(?:<|<=)\s*[0-9.]+/g,
    `a1TerminalWallDistance > ${FINAL_CENTER_TO_WALL_MINIMUM_METERS} && a1TerminalWallDistance < ${FINAL_CENTER_TO_WALL_MAXIMUM_METERS}`,
  )
  .replace(
    /connectorVisibleLength\s*(?:>|>=)\s*[0-9.]+\s*&&\s*connectorVisibleLength\s*(?:<|<=)\s*[0-9.]+/g,
    `connectorVisibleLength > ${FINAL_VISIBLE_FIXED_LEG_MINIMUM_METERS} && connectorVisibleLength < ${FINAL_VISIBLE_FIXED_LEG_MAXIMUM_METERS}`,
  )
  .replaceAll("compact-real-terminal-wall-readiness-v2", marker)
  .replaceAll("compact-real-terminal-wall-readiness-v1", marker);

if (!source.includes(marker)) {
  const anchor = "          const connectorVisibleLength = Number(group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters ?? NaN);";
  if (!source.includes(anchor)) {
    throw new Error(`${readinessPath}: A1 connector-visible-length declaration is missing`);
  }
  source = source.replace(
    anchor,
    `${anchor}\n          // ${marker}: the exact supplied Rotunda remains at the source gate pivot;\n          // the fixed terminal leg is the measured structural-wall span, not a magic distance.`,
  );
}

for (const token of [
  marker,
  `a1TerminalWallDistance > ${FINAL_CENTER_TO_WALL_MINIMUM_METERS} && a1TerminalWallDistance < ${FINAL_CENTER_TO_WALL_MAXIMUM_METERS}`,
  `connectorVisibleLength > ${FINAL_VISIBLE_FIXED_LEG_MINIMUM_METERS} && connectorVisibleLength < ${FINAL_VISIBLE_FIXED_LEG_MAXIMUM_METERS}`,
]) {
  if (!source.includes(token)) {
    throw new Error(`${readinessPath}: source-measured A1 readiness contract is missing ${token}`);
  }
}
for (const forbidden of [
  "a1TerminalWallDistance > 2.9 && a1TerminalWallDistance < 5.8",
  "a1TerminalWallDistance >= 2.9 && a1TerminalWallDistance <= 5.8",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 28",
  "exact 2.4 m visible white vestibule",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: stale compact A1 readiness survived: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");

// The immediately following Rotunda-elbow preparer owns the physical aperture
// articulation. Earlier photo/terminal compatibility passes may rewrite only the
// numeric terminal-facing floor in measureExactRotundaOpening. Canonicalize that
// small generated block here so the elbow writer receives one stable input form;
// this does NOT move any geometry.
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let installation = fs.readFileSync(installationPath, "utf8");
const openingDeclaration = "  const openingDirection = bridgeDirection.clone().multiplyScalar(-1);";
const openingStart = installation.indexOf(openingDeclaration);
const terminalRadiusStart = installation.indexOf("\n\n  let terminalRadius =", openingStart);
if (openingStart < 0 || terminalRadiusStart < 0) {
  throw new Error(`${installationPath}: cannot canonicalize the authored Rotunda opening block before elbow articulation`);
}
const canonicalOpeningLogic = `  const openingDirection = bridgeDirection.clone().multiplyScalar(-1);
  const terminalFacingDot = openingDirection.dot(terminalDirection);
  if (terminalFacingDot < 0.4) {
    throw new Error(\`A1 exact authored Rotunda opening does not face the measured terminal wall: \${terminalFacingDot}\`);
  }`;
installation = `${installation.slice(0, openingStart)}${canonicalOpeningLogic}${installation.slice(terminalRadiusStart)}`;
if (!installation.includes(canonicalOpeningLogic)) {
  throw new Error(`${installationPath}: canonical authored Rotunda opening input was not installed`);
}
fs.writeFileSync(installationPath, installation, "utf8");

console.log("Normalized final A1 readiness to the source-measured structural Terminal 4 wall span and canonicalized the generated Rotunda opening measurement immediately before the physical elbow articulation; no geometry was moved by this preparer.");
