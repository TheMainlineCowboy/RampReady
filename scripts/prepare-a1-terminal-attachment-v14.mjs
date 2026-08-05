import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");

const marker = "nearest-structural-wall-triangle-surface-v14";
if (!source.includes(marker)) {
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
  const triangle = new THREE.Triangle();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let nearest = null;

  const triangleMaterial = (node, triangleOffset) => {
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.length <= 1) return materials[0] || null;
    const group = node.geometry?.groups?.find((entry) => (
      triangleOffset >= entry.start && triangleOffset < entry.start + entry.count
    ));
    return materials[group?.materialIndex ?? 0] || materials[0] || null;
  };

  terminal.traverse((node) => {
    if (!node.isMesh || node.visible === false) return;
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
      // Terminal attachment must land on a facade, never a roof, floor, ramp,
      // or the elevated T4_WALK corridor that was previously forced at A1.
      if (Math.abs(normal.y) > 0.72) continue;
      const minimumY = Math.min(a.y, b.y, c.y);
      const maximumY = Math.max(a.y, b.y, c.y);
      if (height < minimumY - 0.35 || height > maximumY + 0.35) continue;
      triangle.closestPointToPoint(origin, closest);
      const dx = closest.x - originX;
      const dz = closest.z - originZ;
      const horizontalDistance = Math.hypot(dx, dz);
      const verticalError = Math.abs(closest.y - height);
      if (!(horizontalDistance > 0.05 && horizontalDistance <= 48 && verticalError <= 0.65)) continue;
      const score = horizontalDistance + verticalError * 4;
      if (!nearest || score < nearest.score) {
        nearest = {
          score,
          distance: horizontalDistance,
          towardX: dx / horizontalDistance,
          towardZ: dz / horizontalDistance,
          pointX: closest.x,
          pointY: closest.y,
          pointZ: closest.z,
          authority: "nearest-structural-wall-triangle-surface-v14",
        };
      }
    }
  });
  if (nearest) return nearest;

  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();
  const cast = (direction, far = 48) => {
    const raycaster = new THREE.Raycaster(origin, direction, 0.05, far);
    const hit = raycaster.intersectObject(terminal, true).find((entry) => {
      if (entry.object?.visible === false) return false;
      const materials = Array.isArray(entry.object?.material)
        ? entry.object.material
        : [entry.object?.material];
      const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
      return structuralMaterial.test(material?.name || "");
    });
    if (!(hit?.distance > 0.05)) return null;
    return {
      distance: hit.distance,
      towardX: direction.x,
      towardZ: direction.z,
      pointX: hit.point.x,
      pointY: hit.point.y,
      pointZ: hit.point.z,
      authority: "structural-facade-raycast-fallback-v14",
    };
  };
  const preferredHit = cast(preferred);
  if (preferredHit) return preferredHit;
  let nearestHit = null;
  for (let sample = 0; sample < 360; sample += 1) {
    const angle = (sample / 360) * Math.PI * 2;
    const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const hit = cast(direction);
    if (hit && (!nearestHit || hit.distance < nearestHit.distance)) nearestHit = hit;
  }
  return nearestHit;
}`;

  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

// Remove the old A1-only override that forced the jetway to the elevated
// T4_WALK portal. A1 must use the same nearest structural terminal-facade
// solution as every other gate.
const falseWalkwayOverride = /\n    if \(jetway\.g === "A1"\) \{\n      const exactWalkwayPortalX = -30\.16857013;[\s\S]*?\n    \}\n    const terminalWallDistance/;
if (falseWalkwayOverride.test(source)) {
  source = source.replace(falseWalkwayOverride, "\n    const terminalWallDistance");
}

for (const token of [
  marker,
  "Terminal attachment must land on a facade",
  "structural-facade-raycast-fallback-v14",
]) {
  if (!source.includes(token)) {
    throw new Error(`${jetwayPath}: A1 terminal attachment token missing: ${token}`);
  }
}
for (const forbidden of [
  "exact-T4_WALK-A1-terminal-portal-v25",
  "exactWalkwayPortalX",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${jetwayPath}: false A1 walkway override remains: ${forbidden}`);
  }
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log("Prepared A1 terminal attachment using the nearest real vertical Terminal 4 wall and removed the false T4_WALK override.");
