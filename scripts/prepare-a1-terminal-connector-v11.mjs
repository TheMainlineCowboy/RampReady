import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");

function replaceRequired(before, after, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${jetwayPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

const independentStructuralFit = [
  "function findTerminalWallConnection",
  "const cast = (direction, far = 48)",
  "return /BGATE|DGATE|PHX_TERM400/i.test",
  "distance <= 48",
  "1.25, 44",
  "independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12",
].every((token) => source.includes(token));

if (!independentStructuralFit && source.includes("function findTerminalWallConnection")) {
  replaceRequired(
    "  const cast = (direction, far = 24) => {",
    "  const cast = (direction, far = 48) => {",
    "const cast = (direction, far = 48)",
    "independent terminal ray reach",
  );
  replaceRequired(
    "    const hit = raycaster.intersectObject(terminal, true).find((entry) => entry.object?.visible !== false);",
    `    const hit = raycaster.intersectObject(terminal, true).find((entry) => {
      if (entry.object?.visible === false) return false;
      const materials = Array.isArray(entry.object?.material)
        ? entry.object.material
        : [entry.object?.material];
      const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
      return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");
    });`,
    "return /BGATE|DGATE|PHX_TERM400/i.test",
    "structural terminal facade filtering",
  );
  replaceRequired(
    `    if (!node.isMesh || node.visible === false) return;
    const position = node.geometry?.getAttribute?.("position");`,
    `    if (!node.isMesh || node.visible === false) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test(material?.name || ""))) return;
    const position = node.geometry?.getAttribute?.("position");`,
    "materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test",
    "structural terminal vertex filtering",
  );
  replaceRequired(
    "      if (distance > 0.05 && distance <= 24 && distance < nearestDistance) {",
    "      if (distance > 0.05 && distance <= 48 && distance < nearestDistance) {",
    "distance <= 48",
    "terminal vertex reach",
  );
  replaceRequired(
    "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);",
    "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);",
    "1.25, 44",
    "terminal connector length",
  );
  replaceRequired(
    "  group.userData.terminalConnectionAuthority = \"independent-rotunda-collar-fit-to-authored-terminal-wall\";",
    "  group.userData.terminalConnectionAuthority = \"independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12\";",
    "independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12",
    "terminal connector authority",
  );
} else if (!independentStructuralFit) {
  replaceRequired(
    "  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 24);",
    "  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 48);",
    "new THREE.Raycaster(origin, direction, 0.05, 48)",
    "legacy terminal ray reach",
  );
  replaceRequired(
    "  const hit = raycaster.intersectObject(terminal, true).find((entry) => entry.object?.visible !== false);",
    `  const hit = raycaster.intersectObject(terminal, true).find((entry) => {
    if (entry.object?.visible === false) return false;
    const materials = Array.isArray(entry.object?.material)
      ? entry.object.material
      : [entry.object?.material];
    const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
    return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");
  });`,
    "return /BGATE|DGATE|PHX_TERM400/i.test",
    "legacy structural terminal facade filtering",
  );
  replaceRequired(
    "      if (!(longitudinal > 0.05 && longitudinal <= 24)) continue;",
    "      if (!(longitudinal > 0.05 && longitudinal <= 48)) continue;",
    "longitudinal <= 48",
    "legacy terminal vertex corridor reach",
  );
  replaceRequired(
    "      if (lateral <= 4.5) nearest = Math.min(nearest, longitudinal);",
    "      if (lateral <= 5.5) nearest = Math.min(nearest, longitudinal);",
    "lateral <= 5.5",
    "legacy terminal vertex corridor width",
  );
  replaceRequired(
    "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);",
    "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);",
    "1.25, 44",
    "legacy terminal connector length",
  );
  replaceRequired(
    "  group.userData.terminalConnectionAuthority = \"raycast-and-source-vertex-fit-to-authored-terminal-mesh\";",
    "  group.userData.terminalConnectionAuthority = \"48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11\";",
    "48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11",
    "legacy terminal connector authority",
  );
}

// Gate A1 sits at a Terminal 4 corner where a radial search can select a valid
// but visually unrelated structural face. Use the exact BGATE1 wall plane from
// the supplied Terminal 4 mesh at the jetway elevation. Coordinates are in the
// source-placed jetway group's A1-local frame after its +6.2 m Z scene offset.
const committedA1Connection = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );`;
const exactA1Connection = `    let terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );
    if (jetway.g === "A1") {
      const exactWallX = -3.55299146;
      const exactWallZ = -40.60699866;
      const exactDx = exactWallX - jetway.x;
      const exactDz = exactWallZ - jetway.z;
      const exactDistance = Math.hypot(exactDx, exactDz);
      terminalConnection = {
        distance: exactDistance,
        towardX: exactDx / exactDistance,
        towardZ: exactDz / exactDistance,
        authority: "exact-BGATE1-A1-terminal-wall-plane-v14",
      };
    }`;
replaceRequired(
  committedA1Connection,
  exactA1Connection,
  "exact-BGATE1-A1-terminal-wall-plane-v14",
  "exact A1 Terminal 4 wall-plane connection",
);

const independentPrepared = [
  "function findTerminalWallConnection",
  "const cast = (direction, far = 48)",
  "return /BGATE|DGATE|PHX_TERM400/i.test",
  "distance <= 48",
  "1.25, 44",
  "independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12",
].every((token) => source.includes(token));
const legacyPrepared = [
  "new THREE.Raycaster(origin, direction, 0.05, 48)",
  "return /BGATE|DGATE|PHX_TERM400/i.test",
  "longitudinal <= 48",
  "lateral <= 5.5",
  "1.25, 44",
  "48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11",
].every((token) => source.includes(token));
if ((!independentPrepared && !legacyPrepared) || !source.includes("exact-BGATE1-A1-terminal-wall-plane-v14")) {
  throw new Error(`${jetwayPath}: structural A1 terminal connector preparation is incomplete`);
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log(independentPrepared
  ? "Prepared A1 terminal connector v14 at the exact supplied BGATE1 wall plane, with radial structural fitting retained for every other gate."
  : "Prepared legacy A1 terminal connector v14 at the exact supplied BGATE1 wall plane.");
