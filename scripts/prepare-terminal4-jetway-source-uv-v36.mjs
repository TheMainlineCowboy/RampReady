import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");
const marker = "source-length-height-shell-projection-v36";

if (!source.includes(marker)) {
  const oldBlock = `  const position = geometry.getAttribute("position");
  const normalizedUv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    normalizedUv[index * 2] = clamp(position.getX(index) / width + 0.5, 0, 1);
    normalizedUv[index * 2 + 1] = clamp(position.getY(index) / height + 0.5, 0, 1);
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(normalizedUv, 2));`;
  const newBlock = `  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const normalizedUv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const nx = Math.abs(normal.getX(index));
    const ny = Math.abs(normal.getY(index));
    const nz = Math.abs(normal.getZ(index));
    const longitudinalShell = nz < 0.72 && (nx > 0.35 || ny > 0.2);
    // M1DGJETWAY's recovered shell strip contains repeated vertical wall ribs.
    // Project U along the bridge length on the visible walls/roof instead of
    // sampling a single atlas column from constant side-wall X coordinates.
    normalizedUv[index * 2] = longitudinalShell
      ? clamp(z + 0.5, 0, 1)
      : clamp(x / width + 0.5, 0, 1);
    normalizedUv[index * 2 + 1] = longitudinalShell && ny > nx
      ? clamp(x / width + 0.5, 0, 1)
      : clamp(y / height + 0.5, 0, 1);
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(normalizedUv, 2));
  geometry.userData.sourceJetwayUvAuthority = "${marker}";`;
  if (!source.includes(oldBlock)) throw new Error("Terminal 4 jetway tunnel UV anchor is missing");
  source = source.replace(oldBlock, newBlock);
}

for (const token of [
  "const longitudinalShell = nz < 0.72",
  "clamp(z + 0.5, 0, 1)",
  marker,
]) {
  if (!source.includes(token)) throw new Error(`Terminal 4 jetway source UV preparation missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared Terminal 4 jetway shell UV v36: exact M1DGJETWAY corrugation projects along tunnel length on both side walls and roof while end caps retain width-height mapping.");
