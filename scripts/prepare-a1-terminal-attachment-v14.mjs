import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");

const materialIdentityMarker = "facade-source-material-identity-v17";
const diagnosticMarker = "a1-facade-search-diagnostics-v19";
const triangleQualificationMarker = "triangle-qualified-structural-facade-v19";
const start = source.indexOf("function findTerminalWallConnection(");
const end = source.indexOf("\nfunction findTerminalWallDistance(", start);
if (start < 0 || end < 0) {
  throw new Error(`${jetwayPath}: could not locate terminal wall connection function`);
}

const replacement = `function findTerminalWallConnection(THREE, terminal, originX, originZ, preferredX, preferredZ, height) {
  if (!terminal?.isObject3D) return null;
  terminal.updateMatrixWorld(true);
  const origin = new THREE.Vector3(originX, height, originZ);
  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();
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
  const allMaterialReferences = new Set();
  const facadeMaterialReferences = new Set();
  const diagnostics = {
    authority: "${diagnosticMarker}",
    meshCount: 0,
    eligibleNodeCount: 0,
    triangleCount: 0,
    structuralTriangleCount: 0,
    wallNormalTriangleCount: 0,
    areaTriangleCount: 0,
    heightTriangleCount: 0,
    distanceTriangleCount: 0,
    directionTriangleCount: 0,
    nearestDirectionRejected: null,
  };

  const triangleMaterial = (node, triangleOffset) => {
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.length <= 1) return materials[0] || null;
    const group = node.geometry?.groups?.find((entry) => (
      triangleOffset >= entry.start && triangleOffset < entry.start + entry.count
    ));
    return materials[group?.materialIndex ?? 0] || materials[0] || null;
  };

  const structuralMaterialReference = (material) => [
    material?.name,
    material?.userData?.diffuseTexture,
    material?.userData?.sourceDiffuseTexture,
    material?.userData?.runtimeDiffuseTexture,
  ].filter(Boolean).join(" "); // ${materialIdentityMarker}

  terminal.traverse((node) => {
    if (!node.isMesh || node.visible === false) return;
    diagnostics.meshCount += 1;
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    nodeMaterials.forEach((material) => {
      const reference = structuralMaterialReference(material);
      if (reference) allMaterialReferences.add(reference);
    });
    if (rejectedNodeName.test(node.name || "")) return;

    // ${triangleQualificationMarker}
    // The converted Terminal 4 packs many separate facade sections into broad
    // material meshes. A node bounding box therefore cannot identify a wall.
    // Qualification must happen per triangle using exact source material,
    // wall normal, area, height, distance and terminal-facing direction.
    diagnostics.eligibleNodeCount += 1;
    nodeBox.setFromObject(node);
    nodeBox.getSize(nodeSize);
    const geometry = node.geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position) return;
    const index = geometry.index;
    const triangleCount = Math.floor((index?.count ?? position.count) / 3);
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      diagnostics.triangleCount += 1;
      const triangleOffset = triangleIndex * 3;
      const material = triangleMaterial(node, triangleOffset);
      const materialReference = structuralMaterialReference(material);
      if (!structuralMaterial.test(materialReference)) continue;
      diagnostics.structuralTriangleCount += 1;
      facadeMaterialReferences.add(materialReference);

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
      diagnostics.wallNormalTriangleCount += 1;
      const area = triangle.getArea();
      if (area < 0.45) continue;
      diagnostics.areaTriangleCount += 1;
      const minimumY = Math.min(a.y, b.y, c.y);
      const maximumY = Math.max(a.y, b.y, c.y);
      if (height < minimumY - 0.35 || height > maximumY + 0.35) continue;
      diagnostics.heightTriangleCount += 1;
      triangle.closestPointToPoint(origin, closest);
      const dx = closest.x - originX;
      const dz = closest.z - originZ;
      const horizontalDistance = Math.hypot(dx, dz);
      const verticalError = Math.abs(closest.y - height);
      if (!(horizontalDistance > 0.05 && horizontalDistance <= 48 && verticalError <= 0.65)) continue;
      diagnostics.distanceTriangleCount += 1;
      const candidateDirection = new THREE.Vector3(dx, 0, dz).normalize();
      const directionDot = candidateDirection.dot(preferred);
      if (directionDot < 0.15) {
        if (!diagnostics.nearestDirectionRejected || horizontalDistance < diagnostics.nearestDirectionRejected.distance) {
          diagnostics.nearestDirectionRejected = {
            nodeName: node.name || "unnamed",
            materialReference,
            distance: horizontalDistance,
            verticalError,
            directionDot,
            point: [closest.x, closest.y, closest.z],
            nodeSize: [nodeSize.x, nodeSize.y, nodeSize.z],
            triangleArea: area,
          };
        }
        continue;
      }
      diagnostics.directionTriangleCount += 1;
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
          materialReference,
          authority: "facade-contiguous-structural-wall-surface-v17",
        };
      }
    }
  });
  diagnostics.allMaterialReferences = [...allMaterialReferences].slice(0, 24);
  diagnostics.facadeMaterialReferences = [...facadeMaterialReferences].slice(0, 24);
  terminal.userData.a1WallSearchDiagnostics = diagnostics;
  return nearest;
}`;

source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;

const falseWalkwayOverride = /\n    if \(jetway\.g === "A1"\) \{\n      const exactWalkwayPortalX = -30\.16857013;[\s\S]*?\n    \}\n    const terminalWallDistance/;
if (falseWalkwayOverride.test(source)) {
  source = source.replace(falseWalkwayOverride, "\n    const terminalWallDistance");
}

for (const token of [
  materialIdentityMarker,
  diagnosticMarker,
  triangleQualificationMarker,
  "facade-contiguous-structural-wall-surface-v17",
  "rejectedNodeName",
  "structuralMaterial.test(materialReference)",
  "Math.abs(normal.y) > 0.72",
  "area < 0.45",
  "horizontalDistance <= 48",
  "directionDot < 0.15",
  "material?.userData?.diffuseTexture",
  "material?.userData?.sourceDiffuseTexture",
  "material?.userData?.runtimeDiffuseTexture",
  "terminal.userData.a1WallSearchDiagnostics = diagnostics",
]) {
  if (!source.includes(token)) {
    throw new Error(`${jetwayPath}: A1 triangle-qualified facade token missing: ${token}`);
  }
}
for (const forbidden of [
  "exact-T4_WALK-A1-terminal-portal-v25",
  "exactWalkwayPortalX",
  "nearest-structural-wall-triangle-surface-v14",
  "return horizontalSpan >= 6",
  "thinAxis <= 12",
  "structuralMaterial.test(material?.name || \"\")",
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

console.log("Prepared A1 attachment against exact-source structural facade triangles; converted broad mesh bounds no longer discard the real Terminal 4 wall.");