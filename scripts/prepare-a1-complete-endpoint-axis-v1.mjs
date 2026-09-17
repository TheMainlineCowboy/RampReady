import fs from "node:fs";

// Aug. 15 photo authority owns A1 terminal geometry now:
// BGATE1 facade -> long fixed corridor -> elbow/dogleg -> remote Rotunda ->
// untouched supplied movable Airport_Jetway.glb.  This preparer is retained
// only as a compatibility cleanup for older generated trees.  It must never
// re-introduce the retired 2.4 m/12 m compact-terminal model or move the
// complete supplied parent merely to satisfy a terminal-wall relationship.

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

const newBlock = `  // Compatibility only: determine terminal/apron orientation from the complete
  // supplied bridge without changing any child transform.  Current Aug. 15
  // production geometry normally arrives here already normalized by the
  // photo-authoritative remote-Rotunda path, so this block may be absent.
  const rotundaTerminalCenter = objectBoundsCenterInFleet(THREE, fleet, rotundaEndpoint);
  const cabAircraftCenter = objectBoundsCenterInFleet(THREE, fleet, cabEndpoint);
  const measuredOpeningDirection = rotundaTerminalCenter.clone().sub(cabAircraftCenter);
  measuredOpeningDirection.y = 0;
  if (measuredOpeningDirection.lengthSq() < 4) {
    throw new Error("A1 complete Cab-to-Rotunda endpoint axis is degenerate");
  }
  measuredOpeningDirection.normalize();`;

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
}

// Preserve a useful provenance marker when the declaration still exists, but
// do not require legacy orientation code to survive later photo-authoritative
// preparers.
source = source.replace(
  /const A1_PARENT_ORIENTATION_AUTHORITY = "[^"]+";/,
  'const A1_PARENT_ORIENTATION_AUTHORITY = "aug15-photo-remote-rotunda-complete-parent-axis-v7";',
);

for (const forbidden of [
  "terminalDistance < 12",
  "post-rigid-a1-exact-visible-vestibule-span-v1",
  "exact 2.4 m terminal vestibule",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: retired compact A1 endpoint logic remains: ${forbidden}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Preserved Aug. 15 A1 long fixed corridor/dogleg/remote-Rotunda authority; retired compact endpoint-axis assumptions remain disabled.");
