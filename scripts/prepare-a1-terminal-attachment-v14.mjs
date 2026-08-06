import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");

const marker = "facade-contiguous-structural-wall-surface-v16";
const start = source.indexOf("function findTerminalWallConnection(");
const end = source.indexOf("\nfunction findTerminalWallDistance(", start);
if (start < 0 || end < 0) {
  throw new Error(`${jetwayPath}: could not locate terminal wall connection function`);
}

const replacement = `function findTerminalWallConnection(THREE, terminal, originX, originZ, preferredX, preferredZ, height) {
  if (!terminal?.isObject3D) return null;
  terminal.updateMatrixWorld(true);
  const origin = new THREE.Vector3(originX, height, originZ);
  const structuralMaterial = /BGATE|DGATE|PHX_TERM400/i;
  const rejectedNodeName = /WALK|JETWAY|CONNECTOR|PORTAL|SIGN|COLUMN|LIGHT/i;
  const triangle = new THREE.Triangle();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const nodeBox = new THREE.Box3();
  const nodeSize = new THREE.Vector3();
  let nearest = null;

  const triangleMaterial = (node, triangleOffset) => {
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.length <= 1) return materials[0] || null;
    const group = node.geometry?.groups?.find((entry) => (
      triangleOffset >= entry.start && triangleOffset < entry.start + entry.count
    ));
    return materials[group?.materialIndex ?? 0] || materials[0] || null;
  };

  const isFacadeContiguousNode = (node) => {
    if (rejectedNodeName.test(node.name || "")) return false;
    nodeBox.setFromObject(node);
    nodeBox.getSize(nodeSize);
    const horizontalSpan = Math.max(nodeSize.x, nodeSize.z);
    const thinAxis = Math.min(nodeSize.x, nodeSize.z);
    // Terminal 4's authored facade is split into source mesh sections smaller
    // than 14 m. Accept only wall-sized structural sections while explicitly
    // rejecting walkways, signs, columns, lights, portals and connector pieces.
    return horizontalSpan >= 6 && nodeSize.y >= 2.6 && thinAxis <= 12;
  };

  terminal.traverse((node) => {
    if (!node.isMesh || node.visible === false || !isFacadeContiguousNode(node)) return;
    const geometry = node.geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position) return;
    const index = geometry.index;
    const triangleCount = Math.floor((index?.count ?? position.count) / 3);
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const triangleOffset = triangleIndex * 3;
      const material = triangleMaterial(node, triangleOffset);
      if (!structuralMaterial.test(material?.name || "")) continue;
      const ai = index ? index.getX(triangleOffset) : triangleOffset;
      const bi = index ? index.getX(triangleOffset + 1) : triangleOffset + 1;
      const ci = index ? index.getX(triangleOffset + 2) : triangleOffset + 2;
      a.fromBufferAttribute(position, ai);
      b.fromBufferAttribute(position, bi);
      c.fromBufferAttribute(position, ci);
      node.localToWorld(a);
      node.localToWorld(b);
      node.localToWorld(c);
      triangle.set(a, b, c);
      triangle.getNormal(normal);
      if (Math.abs(normal.y) > 0.72) continue;
      const area = triangle.getArea();
      if (area < 0.45) continue;
      const minimumY = Math.min(a.y, b.y, c.y);
      const maximumY = Math.max(a.y, b.y, c.y);
      if (height < minimumY - 0.35 || height > maximumY + 0.35) continue;
      triangle.closestPointToPoint(origin, closest);
      const dx = closest.x - originX;
      const dz = closest.z - originZ;
      const horizontalDistance = Math.hypot(dx, dz);
      const verticalError = Math.abs(closest.y - height);
      if (!(horizontalDistance > 0.05 && horizontalDistance <= 48 && verticalError <= 0.65)) continue;
      const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();
      const candidateDirection = new THREE.Vector3(dx, 0, dz).normalize();
      const directionDot = candidateDirection.dot(preferred);
      if (directionDot < 0.15) continue;
      const directionPenalty = Math.max(0, 1 - directionDot) * 2.5;
      const score = horizontalDistance + verticalError * 4 + directionPenalty;
      if (!nearest || score < nearest.score) {
        nearest = {
          score,
          distance: horizontalDistance,
          towardX: dx / horizontalDistance,
          towardZ: dz / horizontalDistance,
          pointX: closest.x,
          pointY: closest.y,
          pointZ: closest.z,
          nodeSpanX: nodeSize.x,
          nodeSpanY: nodeSize.y,
          nodeSpanZ: nodeSize.z,
          triangleArea: area,
          authority: "facade-contiguous-structural-wall-surface-v16",
        };
      }
    }
  });
  return nearest;
}`;

source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;

const falseWalkwayOverride = /\n    if \(jetway\.g === "A1"\) \{\n      const exactWalkwayPortalX = -30\.16857013;[\s\S]*?\n    \}\n    const terminalWallDistance/;
if (falseWalkwayOverride.test(source)) {
  source = source.replace(falseWalkwayOverride, "\n    const terminalWallDistance");
}

for (const token of [
  marker,
  "Terminal 4's authored facade is split",
  "horizontalSpan >= 6",
  "nodeSize.y >= 2.6",
  "rejectedNodeName",
  "directionDot < 0.15",
  "triangleArea: area",
]) {
  if (!source.includes(token)) {
    throw new Error(`${jetwayPath}: A1 contiguous-facade token missing: ${token}`);
  }
}
for (const forbidden of [
  "exact-T4_WALK-A1-terminal-portal-v25",
  "exactWalkwayPortalX",
  "nearest-structural-wall-triangle-surface-v14",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${jetwayPath}: stale A1 wall authority remains: ${forbidden}`);
  }
}

fs.writeFileSync(jetwayPath, source, "utf8");

const boundedFacadeFiles = [
  "src/environment/correctUploadedJetwayInstallationV1.js",
  "src/environment/uploadedAirportJetwayFleetReadyV2.js",
];
for (const runtimePath of boundedFacadeFiles) {
  let runtime = fs.readFileSync(runtimePath, "utf8");
  runtime = runtime
    .replaceAll("terminalDistance > 0.4 && terminalDistance < 12", "terminalDistance > 0.4 && terminalDistance < 28")
    .replaceAll("mainVisibleLength > 0.25 && mainVisibleLength < 12", "mainVisibleLength > 0.25 && mainVisibleLength < 28")
    .replaceAll("a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12", "a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 28")
    .replaceAll("connectorVisibleLength > 0.25 && connectorVisibleLength < 12", "connectorVisibleLength > 0.25 && connectorVisibleLength < 28")
    .replaceAll("if (terminalFacingDot < 0.4)", "if (terminalFacingDot < 0.15)")
    .replaceAll(
      "const terminalFacingDot = openingDirection.dot(terminalDirection);",
      "const terminalFacingDot = openingDirection.dot(terminalDirection);\n  const terminalCornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(terminalFacingDot, -1, 1)));",
    )
    .replaceAll(
      "terminalFacingDot,\n    terminalRadius,",
      "terminalFacingDot,\n    terminalCornerAngleDegrees,\n    terminalRadius,",
    )
    .replaceAll(
      "connector.userData.measuredWallDirection = [terminalDirection.x, terminalDirection.z];",
      "connector.userData.measuredWallDirection = [terminalDirection.x, terminalDirection.z];\n  connector.userData.terminalCornerAngleDegrees = rotundaOpening.terminalCornerAngleDegrees;",
    );
  fs.writeFileSync(runtimePath, runtime, "utf8");
}

console.log("Prepared A1 attachment against a facade-contiguous Terminal 4 wall surface, accepting source-split structural facade sections while rejecting isolated ramp fragments and preserving the short photo-matched Rotunda vestibule.");
