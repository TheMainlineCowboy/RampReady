import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const AUTHORITY = "a1-terminal-shell-rendered-at-tunnel-a-passenger-center-v1";
const DOGLEG_AUTHORITY = "a1-aug15-photo-fixed-corridor-dogleg-v1";
let source = fs.readFileSync(sourcePath, "utf8");

if (!source.includes("const passengerCenterY = (tunnelRotundaEndpointMinY + tunnelRotundaEndpointMaxY) * 0.5;")) {
  throw new Error(`${sourcePath}: Tunnel-A passenger centerline has not been measured before shell construction`);
}
if (!source.includes("const width = tunnelCrossSectionWidthMeters;") || !source.includes("const height = tunnelCrossSectionHeightMeters;")) {
  throw new Error(`${sourcePath}: terminal shell cross-section is not derived from Tunnel A`);
}

const doglegPrepared = source.includes(DOGLEG_AUTHORITY);
if (doglegPrepared) {
  // A1 now has two fixed terminal-side legs. Keep both at the exact passenger
  // centerline measured from the supplied Tunnel A; never use Rotunda bounds,
  // whose pedestal drags the rendered passage below passenger height.
  const firstWrong = "const firstFrame = addContinuousShell(THREE, connector, materials, firstShellStart, firstShellVector, firstShellLength, rotundaCenter.y, width, height);";
  const firstCorrect = "const firstFrame = addContinuousShell(THREE, connector, materials, firstShellStart, firstShellVector, firstShellLength, passengerCenterY, width, height);";
  const secondWrong = "const secondFrame = addContinuousShell(THREE, connector, materials, secondShellStart, secondShellVector, secondShellLength, rotundaCenter.y, width, height);";
  const secondCorrect = "const secondFrame = addContinuousShell(THREE, connector, materials, secondShellStart, secondShellVector, secondShellLength, passengerCenterY, width, height);";
  if (source.includes(firstWrong)) source = source.replace(firstWrong, firstCorrect);
  if (source.includes(secondWrong)) source = source.replace(secondWrong, secondCorrect);
  if (!source.includes(firstCorrect) || !source.includes(secondCorrect)) {
    throw new Error(`${sourcePath}: dogleg A1 fixed corridor legs are not both constructed at passengerCenterY`);
  }

  // The fixed elbow roof/floor and posts are centered on doglegElbowPoint, so
  // explicitly lock that point to the same passenger centerline before those
  // pieces are created.
  const elbowAnchor = "  doglegElbowPoint.y = rotundaCenter.y;";
  const elbowCorrect = "  doglegElbowPoint.y = passengerCenterY;";
  if (source.includes(elbowAnchor)) source = source.replace(elbowAnchor, elbowCorrect);
  if (!source.includes(elbowCorrect)) {
    throw new Error(`${sourcePath}: A1 dogleg elbow is not locked to passengerCenterY`);
  }
} else {
  // Legacy/direct form retained for non-dogleg source preparation paths.
  const wrongConstruction = "const frame = addContinuousShell(THREE, connector, materials, shellStart, shellVector, shellLength, rotundaCenter.y, width, height);";
  const correctConstruction = "const frame = addContinuousShell(THREE, connector, materials, shellStart, shellVector, shellLength, passengerCenterY, width, height);";
  if (source.includes(wrongConstruction)) {
    source = source.replace(wrongConstruction, correctConstruction);
  } else if (!source.includes(correctConstruction)) {
    throw new Error(`${sourcePath}: A1 terminal-shell construction centerline anchor is missing`);
  }
  if (!source.includes("shellStart.y = passengerCenterY;") || !source.includes("shellEnd.y = passengerCenterY;")) {
    throw new Error(`${sourcePath}: terminal shell endpoints are not locked to the Tunnel-A passenger centerline`);
  }
}

const telemetryAnchor = "  connector.userData.passengerCenterY = passengerCenterY;";
const telemetryLine = `  connector.userData.renderedShellCenterlineAuthority = "${AUTHORITY}";\n  connector.userData.renderedShellCenterY = passengerCenterY;`;
if (!source.includes("connector.userData.renderedShellCenterlineAuthority")) {
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${sourcePath}: passenger-centerline connector telemetry anchor is missing`);
  }
  source = source.replace(telemetryAnchor, `${telemetryAnchor}\n${telemetryLine}`);
}

const groupAnchor = "  group.userData.uploadedJetwayA1PassengerCenterY = passengerCenterY;";
if (!source.includes("uploadedJetwayA1RenderedShellCenterlineAuthority")) {
  if (!source.includes(groupAnchor)) {
    throw new Error(`${sourcePath}: A1 passenger-centerline group telemetry anchor is missing`);
  }
  const errorExpression = doglegPrepared
    ? "0"
    : "Math.abs(passengerCenterY - shellStart.y)";
  source = source.replace(
    groupAnchor,
    `${groupAnchor}\n  group.userData.uploadedJetwayA1RenderedShellCenterlineAuthority = "${AUTHORITY}";\n  group.userData.uploadedJetwayA1RenderedShellCenterY = passengerCenterY;\n  group.userData.uploadedJetwayA1RenderedShellCenterlineErrorMeters = ${errorExpression};`,
  );
}

for (const required of [
  `renderedShellCenterlineAuthority = "${AUTHORITY}"`,
  `uploadedJetwayA1RenderedShellCenterlineAuthority = "${AUTHORITY}"`,
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: final A1 passenger-shell invariant is missing ${required}`);
  }
}
if (doglegPrepared) {
  for (const required of [
    "firstShellLength, passengerCenterY, width, height",
    "secondShellLength, passengerCenterY, width, height",
    "doglegElbowPoint.y = passengerCenterY;",
  ]) {
    if (!source.includes(required)) throw new Error(`${sourcePath}: dogleg passenger-height invariant is missing ${required}`);
  }
} else if (!source.includes("shellLength, passengerCenterY, width, height")) {
  throw new Error(`${sourcePath}: direct terminal shell is not rendered at passengerCenterY`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${AUTHORITY}: ${doglegPrepared ? "both A1 fixed dogleg legs and the elbow" : "the visible A1 building-side shell"} render at Tunnel A passengerCenterY instead of the Rotunda-plus-pedestal bounds center.`);
