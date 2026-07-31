import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");

function replaceRequired(before, after, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${jetwayPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

replaceRequired(
  "  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 24);",
  "  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 48);",
  "new THREE.Raycaster(origin, direction, 0.05, 48)",
  "terminal ray reach",
);
replaceRequired(
  "      if (!(longitudinal > 0.05 && longitudinal <= 24)) continue;",
  "      if (!(longitudinal > 0.05 && longitudinal <= 48)) continue;",
  "longitudinal <= 48",
  "terminal vertex corridor reach",
);
replaceRequired(
  "      if (lateral <= 4.5) nearest = Math.min(nearest, longitudinal);",
  "      if (lateral <= 5.5) nearest = Math.min(nearest, longitudinal);",
  "lateral <= 5.5",
  "terminal vertex corridor width",
);
replaceRequired(
  "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);",
  "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);",
  "1.25, 44",
  "terminal connector length",
);
replaceRequired(
  "  group.userData.terminalConnectionAuthority = \"raycast-and-source-vertex-fit-to-authored-terminal-mesh\";",
  "  group.userData.terminalConnectionAuthority = \"48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11\";",
  "48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11",
  "terminal connector authority",
);

for (const token of [
  "new THREE.Raycaster(origin, direction, 0.05, 48)",
  "longitudinal <= 48",
  "lateral <= 5.5",
  "1.25, 44",
  "48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11",
]) {
  if (!source.includes(token)) throw new Error(`${jetwayPath}: A1 terminal connector v11 is missing ${token}`);
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log("Prepared A1 terminal connector v11: the authored Terminal 4 mesh is searched to 48 m and the source-textured collar can span the measured 28-29 m wall distance instead of falling back to a detached 1.25 m stub.");
