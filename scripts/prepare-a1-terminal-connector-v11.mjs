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
if (!independentPrepared && !legacyPrepared) {
  throw new Error(`${jetwayPath}: structural A1 terminal connector preparation is incomplete`);
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log(independentPrepared
  ? "Prepared A1 terminal connector v12 with independent radial structural-wall fitting, 48 m reach and support/walkway rejection."
  : "Prepared legacy A1 terminal connector v12 with 48 m structural-facade fitting.");
