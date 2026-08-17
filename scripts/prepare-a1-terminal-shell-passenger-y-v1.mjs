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
  const firstWrong = "const firstFrame = addContinuousShell(THREE, connector, materials, firstShellStart, firstShellVector, firstShellLength, rotundaCenter.y, width, height);";
  const firstCorrect = "const firstFrame = addContinuousShell(THREE, connector, materials, firstShellStart, firstShellVector, firstShellLength, passengerCenterY, width, height);";
  const secondWrong = "const secondFrame = addContinuousShell(THREE, connector, materials, secondShellStart, secondShellVector, secondShellLength, rotundaCenter.y, width, height);";
  const secondCorrect = "const secondFrame = addContinuousShell(THREE, connector, materials, secondShellStart, secondShellVector, secondShellLength, passengerCenterY, width, height);";
  if (source.includes(firstWrong)) source = source.replace(firstWrong, firstCorrect);
  if (source.includes(secondWrong)) source = source.replace(secondWrong, secondCorrect);
  if (!source.includes(firstCorrect) || !source.includes(secondCorrect)) {
    throw new Error(`${sourcePath}: dogleg A1 fixed corridor legs are not both constructed at passengerCenterY`);
  }

  const frameAnchor = `  ${firstCorrect}`;
  const renderPointBlock = "  const doglegElbowRenderPoint = doglegElbowPoint.clone();\n  doglegElbowRenderPoint.y = passengerCenterY;\n";
  if (!source.includes("const doglegElbowRenderPoint = doglegElbowPoint.clone();")) {
    if (!source.includes(frameAnchor)) throw new Error(`${sourcePath}: dogleg first-frame construction anchor is missing`);
    source = source.replace(frameAnchor, `${renderPointBlock}${frameAnchor}`);
  }
  source = source.replaceAll(
    "doglegElbowPoint.clone().add(new THREE.Vector3",
    "doglegElbowRenderPoint.clone().add(new THREE.Vector3",
  );
  if (!source.includes("doglegElbowRenderPoint.y = passengerCenterY;")) {
    throw new Error(`${sourcePath}: A1 dogleg elbow render point is not locked to passengerCenterY`);
  }

  source = source.replaceAll("Math.abs(shellStart.y - passengerCenterY)", "0");
  source = source.replaceAll("Math.abs(passengerCenterY - shellStart.y)", "0");
  if (/\bshellStart\b/.test(source)) {
    throw new Error(`${sourcePath}: retired straight-shell shellStart reference survived A1 dogleg preparation`);
  }
} else {
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
const doglegGroupAnchor = "  group.userData.uploadedJetwayA1FixedCorridorDogleg = true;";
if (!source.includes("uploadedJetwayA1RenderedShellCenterlineAuthority")) {
  const errorExpression = doglegPrepared ? "0" : "Math.abs(passengerCenterY - shellStart.y)";
  const groupTelemetry = `  group.userData.uploadedJetwayA1PassengerCenterY = passengerCenterY;\n  group.userData.uploadedJetwayA1RenderedShellCenterlineAuthority = "${AUTHORITY}";\n  group.userData.uploadedJetwayA1RenderedShellCenterY = passengerCenterY;\n  group.userData.uploadedJetwayA1RenderedShellCenterlineErrorMeters = ${errorExpression};`;
  if (source.includes(groupAnchor)) {
    source = source.replace(
      groupAnchor,
      `${groupAnchor}\n  group.userData.uploadedJetwayA1RenderedShellCenterlineAuthority = "${AUTHORITY}";\n  group.userData.uploadedJetwayA1RenderedShellCenterY = passengerCenterY;\n  group.userData.uploadedJetwayA1RenderedShellCenterlineErrorMeters = ${errorExpression};`,
    );
  } else if (doglegPrepared && source.includes(doglegGroupAnchor)) {
    // On a repeated production preparation pass, the photo-dogleg transformer can
    // already own the group telemetry block and the older standalone passenger-Y
    // line is no longer present. Recreate the same read-only passenger centerline
    // telemetry beside the stable dogleg authority instead of failing on history.
    source = source.replace(doglegGroupAnchor, `${doglegGroupAnchor}\n${groupTelemetry}`);
  } else {
    throw new Error(`${sourcePath}: A1 passenger-centerline group telemetry anchor is missing`);
  }
}

for (const required of [
  `renderedShellCenterlineAuthority = "${AUTHORITY}"`,
  `uploadedJetwayA1RenderedShellCenterlineAuthority = "${AUTHORITY}"`,
  "group.userData.uploadedJetwayA1PassengerCenterY = passengerCenterY;",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: final A1 passenger-shell invariant is missing ${required}`);
  }
}
if (doglegPrepared) {
  for (const required of [
    "firstShellLength, passengerCenterY, width, height",
    "secondShellLength, passengerCenterY, width, height",
    "const doglegElbowRenderPoint = doglegElbowPoint.clone();",
    "doglegElbowRenderPoint.y = passengerCenterY;",
    "uploadedJetwayA1TerminalCenterlineErrorMeters = 0",
  ]) {
    if (!source.includes(required)) throw new Error(`${sourcePath}: dogleg passenger-height invariant is missing ${required}`);
  }
  if (source.includes("doglegElbowPoint.y = passengerCenterY;")) {
    throw new Error(`${sourcePath}: dogleg route point illegally references passengerCenterY before initialization`);
  }
} else if (!source.includes("shellLength, passengerCenterY, width, height")) {
  throw new Error(`${sourcePath}: direct terminal shell is not rendered at passengerCenterY`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${AUTHORITY}: ${doglegPrepared ? "both A1 fixed dogleg legs and the deferred elbow render clone, with repeated-pass group telemetry rebound to the stable dogleg authority" : "the visible A1 building-side shell"} render at Tunnel A passengerCenterY instead of the Rotunda-plus-pedestal bounds center.`);
