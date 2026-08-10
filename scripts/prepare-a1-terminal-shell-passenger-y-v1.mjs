import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const AUTHORITY = "a1-terminal-shell-rendered-at-tunnel-a-passenger-center-v1";
let source = fs.readFileSync(sourcePath, "utf8");

// The endpoint-continuity pass already measures Tunnel A's Rotunda-facing
// passenger envelope and assigns shellStart/shellEnd to passengerCenterY.
// The shipped bundle was still passing rotundaCenter.y into addContinuousShell,
// which ignores those corrected endpoint Y values because addContinuousShell
// explicitly overwrites its center.y with the supplied centerY argument. The
// Rotunda bounds include its pedestal, so that one argument rendered the entire
// building-side white shell below the actual passenger tunnel.
const wrongConstruction = "const frame = addContinuousShell(THREE, connector, materials, shellStart, shellVector, shellLength, rotundaCenter.y, width, height);";
const correctConstruction = "const frame = addContinuousShell(THREE, connector, materials, shellStart, shellVector, shellLength, passengerCenterY, width, height);";

if (source.includes(wrongConstruction)) {
  source = source.replace(wrongConstruction, correctConstruction);
} else if (!source.includes(correctConstruction)) {
  throw new Error(`${sourcePath}: A1 terminal-shell construction centerline anchor is missing`);
}

if (!source.includes("const passengerCenterY = (tunnelRotundaEndpointMinY + tunnelRotundaEndpointMaxY) * 0.5;")) {
  throw new Error(`${sourcePath}: Tunnel-A passenger centerline has not been measured before shell construction`);
}
if (!source.includes("shellStart.y = passengerCenterY;") || !source.includes("shellEnd.y = passengerCenterY;")) {
  throw new Error(`${sourcePath}: terminal shell endpoints are not locked to the Tunnel-A passenger centerline`);
}
if (!source.includes("const width = tunnelCrossSectionWidthMeters;") || !source.includes("const height = tunnelCrossSectionHeightMeters;")) {
  throw new Error(`${sourcePath}: terminal shell cross-section is not derived from Tunnel A`);
}
if (source.includes(wrongConstruction)) {
  throw new Error(`${sourcePath}: Rotunda-bounds Y still controls the visible terminal shell`);
}

// Publish the actual render-center authority alongside the existing passenger
// continuity telemetry so the browser can prove the geometry that was drawn,
// rather than merely proving the pre-construction endpoint math.
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
  source = source.replace(
    groupAnchor,
    `${groupAnchor}\n  group.userData.uploadedJetwayA1RenderedShellCenterlineAuthority = "${AUTHORITY}";\n  group.userData.uploadedJetwayA1RenderedShellCenterY = passengerCenterY;\n  group.userData.uploadedJetwayA1RenderedShellCenterlineErrorMeters = Math.abs(passengerCenterY - shellStart.y);`,
  );
}

for (const required of [
  correctConstruction,
  `renderedShellCenterlineAuthority = "${AUTHORITY}"`,
  `uploadedJetwayA1RenderedShellCenterlineAuthority = "${AUTHORITY}"`,
  "uploadedJetwayA1RenderedShellCenterlineErrorMeters = Math.abs(passengerCenterY - shellStart.y)",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: final A1 passenger-shell invariant is missing ${required}`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${AUTHORITY}: the visible A1 building-side shell is constructed at Tunnel A passengerCenterY instead of the Rotunda-plus-pedestal bounds center.`);
