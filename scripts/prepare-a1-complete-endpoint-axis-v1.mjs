import fs from "node:fs";

// The rigid-parent preparer historically reintroduced a 12 m terminal span.
// Enforce the exact photo-visible 2.4 m vestibule before any endpoint-axis
// replacement reads or extends that generated block.
await import(`./prepare-a1-rigid-compact-span-v1.mjs?post-rigid=${Date.now()}`);

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
  "post-rigid-a1-exact-visible-vestibule-span-v1",
  "const rotundaTerminalCenter = objectBoundsCenterInFleet",
  "const cabAircraftCenter = objectBoundsCenterInFleet",
  "rotundaTerminalCenter.clone().sub(cabAircraftCenter)",
  'A1_PARENT_ORIENTATION_AUTHORITY = "same-day-photo-complete-cab-to-rotunda-parent-axis-v6"',
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: complete endpoint-axis output is missing ${token}`);
  }
}
for (const forbidden of [
  "const rotundaAxisCenter = vertexCentroid",
  "terminalDistance < 12",
  "terminalDistance < 28",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: stale endpoint or long terminal span remains: ${forbidden}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Aligned the complete A1 parent from the authored Cab-to-Rotunda endpoint axis after enforcing the exact 2.4 m terminal vestibule, preserving every supplied child transform.");
