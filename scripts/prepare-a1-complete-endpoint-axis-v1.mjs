import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const oldBlock = `  const rotundaAxisCenter = vertexCentroid(
    THREE,
    transformedGeometryVertices(THREE, fleet, rotundaAxisMesh),
  );
  const tunnelAAxisCenter = vertexCentroid(
    THREE,
    transformedGeometryVertices(THREE, fleet, tunnelAAxisMesh),
  );
  const measuredOpeningDirection = rotundaAxisCenter.clone().sub(tunnelAAxisCenter);
  measuredOpeningDirection.y = 0;
  if (measuredOpeningDirection.lengthSq() < 0.25) {
    throw new Error("A1 measured authored Rotunda opening axis is degenerate");
  }
  measuredOpeningDirection.normalize();`;

const newBlock = `  // Determine terminal/apron orientation from the complete supplied bridge,
  // not from a local Rotunda-to-Tunnel-A opening vector. In the authored
  // hierarchy the Rotunda is the terminal endpoint and the Cab is the aircraft
  // endpoint, so Cab -> Rotunda is the only unambiguous terminal direction.
  // Rotate only the complete parent around the fixed Cab; every GLB child
  // transform remains untouched.
  const rotundaTerminalCenter = objectBoundsCenterInFleet(THREE, fleet, rotundaEndpoint);
  const cabAircraftCenter = objectBoundsCenterInFleet(THREE, fleet, cabEndpoint);
  const measuredOpeningDirection = rotundaTerminalCenter.clone().sub(cabAircraftCenter);
  measuredOpeningDirection.y = 0;
  if (measuredOpeningDirection.lengthSq() < 4) {
    throw new Error("A1 complete Cab-to-Rotunda endpoint axis is degenerate");
  }
  measuredOpeningDirection.normalize();`;

if (!source.includes(oldBlock)) {
  throw new Error(`${installationPath}: local Rotunda-to-Tunnel-A orientation block is missing`);
}
source = source.replace(oldBlock, newBlock);

source = source.replace(
  /const A1_PARENT_ORIENTATION_AUTHORITY = "[^"]+";/,
  'const A1_PARENT_ORIENTATION_AUTHORITY = "same-day-photo-complete-cab-to-rotunda-parent-axis-v6";',
);

for (const token of [
  "const rotundaTerminalCenter = objectBoundsCenterInFleet",
  "const cabAircraftCenter = objectBoundsCenterInFleet",
  "rotundaTerminalCenter.clone().sub(cabAircraftCenter)",
  'A1_PARENT_ORIENTATION_AUTHORITY = "same-day-photo-complete-cab-to-rotunda-parent-axis-v6"',
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: complete endpoint-axis output is missing ${token}`);
  }
}
if (source.includes("const rotundaAxisCenter = vertexCentroid")) {
  throw new Error(`${installationPath}: ambiguous local Rotunda opening axis remains active`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Aligned the complete A1 parent from the authored Cab-to-Rotunda endpoint axis, preserving all supplied child transforms while placing the Rotunda terminal-side and Cab apron-side.");
