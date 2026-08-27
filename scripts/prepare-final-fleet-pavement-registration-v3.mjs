import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleet.js";
const marker = "rendered-kphx-pavement-per-gate-v7-a1-visible-undercarriage-ground-registration";
let source = fs.readFileSync(path, "utf8");

const oldV6Marker = "rendered-kphx-pavement-per-gate-v6-a1-tunnel-c-rigid-ground-registration";

const oldHelper = `function renderedPavementYAt(THREE, group, x, z) {
  const root = rootOf(group);
  let ground = null;
  for (const name of GROUND_NAMES) {
    ground = root?.getObjectByName?.(name) || null;
    if (ground) break;
  }
  if (!ground) throw new Error(\`Exact jetway fleet cannot resolve rendered KPHX pavement at \${x},\${z}\`);
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 60, z), new THREE.Vector3(0, -1, 0), 0, 200);
  const hit = ray.intersectObject(ground, true)[0];
  if (!hit?.point) throw new Error(\`Exact jetway fleet pavement ray missed \${x},\${z}\`);
  return hit.point.y;
}`;

const newHelper = `// ${marker}
function findAttachedAuthoredGround(group) {
  let current = group;
  while (current) {
    const ground = current.getObjectByName?.("PHX_KPHX_AuthoredAirportWideGround") || null;
    if (ground?.isObject3D) return ground;
    current = current.parent;
  }
  return null;
}

async function waitForRenderedGround(group) {
  for (let attempt = 0; attempt < 3750; attempt += 1) {
    const ground = findAttachedAuthoredGround(group);
    if (ground) return ground;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  throw new Error("Exact jetway fleet timed out waiting for PHX_KPHX_AuthoredAirportWideGround scene attachment");
}

function renderedPavementYAt(THREE, group, x, z, ground) {
  if (!ground) throw new Error(\`Exact jetway fleet cannot resolve rendered KPHX pavement at \${x},\${z}\`);
  group.updateWorldMatrix(true, false);
  ground.updateWorldMatrix(true, true);
  const worldProbe = group.localToWorld(new THREE.Vector3(x, 0, z));
  const ray = new THREE.Raycaster(
    new THREE.Vector3(worldProbe.x, worldProbe.y + 80, worldProbe.z),
    new THREE.Vector3(0, -1, 0),
    0,
    240,
  );
  const hit = ray.intersectObject(ground, true).find((candidate) => candidate?.object?.visible !== false);
  if (!hit?.point) throw new Error(\`Exact jetway fleet pavement ray missed local \${x},\${z} / world \${worldProbe.x},\${worldProbe.z}\`);
  return group.worldToLocal(hit.point.clone()).y;
}

function tunnelCDisconnectedComponents(mesh) {
  const position = mesh.geometry?.getAttribute?.("position");
  if (!position) return [];
  const index = mesh.geometry.index;
  const triangleCount = Math.floor((index?.count ?? position.count) / 3);
  const parent = new Int32Array(triangleCount);
  for (let i = 0; i < triangleCount; i += 1) parent[i] = i;
  const find = (value) => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const seen = new Map();
  const keyForVertex = (vertexIndex) => {
    if (index) return \`i\${vertexIndex}\`;
    return [position.getX(vertexIndex), position.getY(vertexIndex), position.getZ(vertexIndex)]
      .map((value) => Math.round(value * 10000)).join(",");
  };
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertexIndex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
      const key = keyForVertex(vertexIndex);
      const prior = seen.get(key);
      if (prior === undefined) seen.set(key, triangle);
      else union(triangle, prior);
    }
  }
  const grouped = new Map();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = find(triangle);
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root).push(triangle);
  }
  return [...grouped.values()];
}

function componentWorldBounds(THREE, mesh, triangles) {
  const position = mesh.geometry.getAttribute("position");
  const index = mesh.geometry.index;
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertexIndex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
      point.fromBufferAttribute(position, vertexIndex).applyMatrix4(mesh.matrixWorld);
      box.expandByPoint(point);
    }
  }
  return box;
}

function resolveVisibleTunnelCUndercarriage(THREE, group, a1Anchor, carrier, ground) {
  const rotunda = a1Anchor.getObjectByName("Rotunda");
  const cab = a1Anchor.getObjectByName("Cab");
  if (!rotunda || !cab) throw new Error("A1 visible undercarriage grounding cannot resolve Rotunda/Cab axis");
  const rotundaCenter = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
  const cabCenter = new THREE.Box3().setFromObject(cab).getCenter(new THREE.Vector3());
  const axis = cabCenter.clone().sub(rotundaCenter).setY(0);
  const axisLengthSq = axis.lengthSq();
  if (!(axisLengthSq > 1)) throw new Error("A1 visible undercarriage grounding has a degenerate bridge axis");

  const carrierBox = new THREE.Box3().setFromObject(carrier);
  const carrierCenterY = carrierBox.getCenter(new THREE.Vector3()).y;
  const candidates = [];
  for (const triangles of tunnelCDisconnectedComponents(carrier)) {
    if (triangles.length < 4) continue;
    const box = componentWorldBounds(THREE, carrier, triangles);
    if (box.isEmpty()) continue;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const horizontalSpan = Math.max(size.x, size.z);
    const fromRotunda = center.clone().sub(rotundaCenter).setY(0);
    const alongRatio = fromRotunda.dot(axis) / axisLengthSq;
    if (!(horizontalSpan >= 0.35 && horizontalSpan <= 5.0)) continue;
    if (!(size.y >= 0.05 && size.y <= 3.5)) continue;
    if (!(center.y <= carrierCenterY && alongRatio > 0.35 && alongRatio < 0.88)) continue;
    const centerLocal = group.worldToLocal(center.clone());
    const groundY = renderedPavementYAt(THREE, group, centerLocal.x, centerLocal.z, ground);
    const bottomLocalY = group.worldToLocal(new THREE.Vector3(center.x, box.min.y, center.z)).y;
    const clearance = bottomLocalY - groundY;
    candidates.push({ triangles, box, size, center, horizontalSpan, alongRatio, groundY, bottomLocalY, clearance });
  }
  if (!candidates.length) {
    throw new Error("A1 visible undercarriage grounding found no substantial Tunnel-C low component");
  }
  candidates.sort((a, b) => a.clearance - b.clearance || b.horizontalSpan - a.horizontalSpan || b.triangles.length - a.triangles.length);
  const selected = candidates[0];
  return {
    ...selected,
    diagnostic: candidates.slice(0, 8).map((candidate) => ({
      triangles: candidate.triangles.length,
      span: Number(candidate.horizontalSpan.toFixed(3)),
      height: Number(candidate.size.y.toFixed(3)),
      along: Number(candidate.alongRatio.toFixed(3)),
      clearance: Number(candidate.clearance.toFixed(3)),
      x: Number(candidate.center.x.toFixed(3)),
      z: Number(candidate.center.z.toFixed(3)),
    })),
  };
}

function registerA1RigidlyFromTunnelC(THREE, group, fleet, a1Anchor, ground, fallbackGroundY) {
  fleet.updateWorldMatrix(true, true);
  const carrier = a1Anchor.getObjectByName("Tunnel_C_Jetway_0");
  if (!carrier?.isMesh) throw new Error("A1 rigid pavement registration cannot resolve Tunnel_C_Jetway_0");
  carrier.updateWorldMatrix(true, false);
  const undercarriage = resolveVisibleTunnelCUndercarriage(THREE, group, a1Anchor, carrier, ground);
  const correction = 0.01 - undercarriage.clearance;
  if (!Number.isFinite(correction) || Math.abs(correction) > 2.0) {
    throw new Error(\`A1 visible Tunnel-C undercarriage grounding correction is implausible: \${correction} m; candidates=\${JSON.stringify(undercarriage.diagnostic)}\`);
  }
  a1Anchor.position.y += correction;
  a1Anchor.updateMatrix();
  fleet.updateWorldMatrix(true, true);

  carrier.updateWorldMatrix(true, false);
  const finalUndercarriage = resolveVisibleTunnelCUndercarriage(THREE, group, a1Anchor, carrier, ground);
  const finalClearance = finalUndercarriage.clearance;
  if (!Number.isFinite(finalClearance) || Math.abs(finalClearance - 0.01) > 0.015) {
    throw new Error(\`A1 visible Tunnel-C undercarriage registration missed pavement: clearance=\${finalClearance} m; candidates=\${JSON.stringify(finalUndercarriage.diagnostic)}\`);
  }
  a1Anchor.userData.renderedPavementGroundY = finalUndercarriage.groundY;
  a1Anchor.userData.a1RigidTunnelCGroundCorrectionMeters = correction;
  a1Anchor.userData.a1RigidTunnelCFinalClearanceMeters = finalClearance;
  a1Anchor.userData.a1RigidTunnelCGroundAuthority = "${marker}";
  a1Anchor.userData.a1RigidTunnelCGroundComponentTriangles = finalUndercarriage.triangles.length;
  a1Anchor.userData.a1RigidTunnelCGroundComponentSpanMeters = finalUndercarriage.horizontalSpan;
  a1Anchor.userData.a1RigidTunnelCGroundComponentAlongRatio = finalUndercarriage.alongRatio;
  return { correction, clearance: finalClearance, groundY: finalUndercarriage.groundY };
}

async function registerFleetToRenderedPavement(THREE, group, fleet, staticFleet, placements) {
  const ground = await waitForRenderedGround(group);
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  if (staticPlacements.length !== 57) throw new Error(\`Deferred pavement registration expected 57 static gates, received \${staticPlacements.length}\`);

  const matrix = new THREE.Matrix4();
  let registeredStaticCount = 0;
  staticPlacements.forEach((placement, instanceIndex) => {
    const localGroundY = renderedPavementYAt(THREE, group, placement.x, placement.z, ground);
    const finalLocalY = localGroundY + LEGACY_FINAL_FLEET_SHIFT_METERS;
    staticFleet.groundYByGate.set(placement.gate, finalLocalY);
    for (const batch of staticFleet.batches.children) {
      if (!batch?.isInstancedMesh) continue;
      batch.getMatrixAt(instanceIndex, matrix);
      matrix.elements[13] = finalLocalY;
      batch.setMatrixAt(instanceIndex, matrix);
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingBox();
      batch.computeBoundingSphere();
    }
    const markerAnchor = fleet.getObjectByName(\`UploadedAirportJetway_\${placement.gate}\`);
    if (markerAnchor) markerAnchor.userData.renderedPavementGroundY = localGroundY;
    registeredStaticCount += 1;
  });

  const a1Placement = placements.find((placement) => placement.gate === "A1");
  const a1Anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  if (!a1Placement || !a1Anchor) throw new Error("Deferred pavement registration lost A1 placement/anchor");
  const a1PlacementGroundY = renderedPavementYAt(THREE, group, a1Placement.x, a1Placement.z, ground);
  a1Anchor.position.y = a1PlacementGroundY + LEGACY_FINAL_FLEET_SHIFT_METERS;
  a1Anchor.updateMatrix();
  fleet.updateWorldMatrix(true, true);
  const a1Ground = registerA1RigidlyFromTunnelC(THREE, group, fleet, a1Anchor, ground, a1PlacementGroundY);

  group.userData.uploadedJetwayGroundRegistrationAuthority = "${marker}";
  group.userData.uploadedJetwayA1RigidTunnelCGroundCorrectionMeters = a1Ground.correction;
  group.userData.uploadedJetwayA1RigidTunnelCFinalClearanceMeters = a1Ground.clearance;
  group.userData.uploadedJetwayGroundRegisteredGateCount = registeredStaticCount + 1;
  group.userData.uploadedJetwayLoadState = "ready";
}
`;

const v6HelperStart = `// ${oldV6Marker}\nfunction findAttachedAuthoredGround(group) {`;
const v6HelperEnd = `\nasync function registerFleetToRenderedPavement(THREE, group, fleet, staticFleet, placements) {`;

if (!source.includes(marker)) {
  if (source.includes(oldV6Marker)) {
    const start = source.indexOf(v6HelperStart);
    const asyncStart = source.indexOf(v6HelperEnd, start);
    if (start < 0 || asyncStart < 0) throw new Error(`${path}: V7 could not locate V6 helper boundaries`);
    const functionStart = asyncStart + 1;
    let depth = 0;
    let entered = false;
    let end = -1;
    for (let i = functionStart; i < source.length; i += 1) {
      const char = source[i];
      if (char === "{") { depth += 1; entered = true; }
      else if (char === "}") {
        depth -= 1;
        if (entered && depth === 0) { end = i + 1; break; }
      }
    }
    if (end < 0) throw new Error(`${path}: V7 could not locate end of V6 pavement registration block`);
    source = source.slice(0, start) + newHelper + source.slice(end);
  } else {
    if (!source.includes(oldHelper)) throw new Error(`${path}: V7 pavement helper anchor is missing`);
    source = source.replace(oldHelper, newHelper);

    const oldGroundMap = `  const groundYByGate = new Map(staticPlacements.map((placement) => [
    placement.gate,
    renderedPavementYAt(THREE, group, placement.x, placement.z) + LEGACY_FINAL_FLEET_SHIFT_METERS,
  ]));`;
    const initialGroundMap = `  // Initial matrices are non-authoritative placeholders. They become visible-ready
  // only after registerFleetToRenderedPavement runs against the attached scene.
  const groundYByGate = new Map(staticPlacements.map((placement) => [
    placement.gate,
    LEGACY_FINAL_FLEET_SHIFT_METERS,
  ]));`;
    if (!source.includes(oldGroundMap)) throw new Error(`${path}: V7 static ground-map anchor is missing`);
    source = source.replace(oldGroundMap, initialGroundMap);

    const oldA1Ground = `          const a1GroundY = renderedPavementYAt(THREE, group, placement.x, placement.z) + LEGACY_FINAL_FLEET_SHIFT_METERS;`;
    const initialA1Ground = `          const a1GroundY = LEGACY_FINAL_FLEET_SHIFT_METERS;`;
    if (!source.includes(oldA1Ground)) throw new Error(`${path}: V7 A1 ground anchor is missing`);
    source = source.replace(oldA1Ground, initialA1Ground);

    source = source.replace(
      `          anchor.userData.renderedPavementGroundY = a1GroundY - LEGACY_FINAL_FLEET_SHIFT_METERS;`,
      `          anchor.userData.renderedPavementGroundY = Number.NaN;`,
    );
    source = source.replace(
      `          anchor.userData.renderedPavementGroundY = staticFleet.groundYByGate.get(placement.gate) - LEGACY_FINAL_FLEET_SHIFT_METERS;`,
      `          anchor.userData.renderedPavementGroundY = Number.NaN;`,
    );

    const readyAnchor = `      group.userData.uploadedJetwayLoadState = "ready";`;
    if (!source.includes(readyAnchor)) throw new Error(`${path}: V7 readiness anchor is missing`);
    source = source.replace(readyAnchor, `      group.userData.uploadedJetwayLoadState = "ground-registering";`);
    source = source.replace(
      `      group.userData.uploadedJetwayGroundRegistrationAuthority = "rendered-kphx-pavement-per-gate-v1";`,
      `      group.userData.uploadedJetwayGroundRegistrationAuthority = "${marker}-pending";`,
    );

    const finalTelemetryAnchor = `      group.userData.proceduralProjectedUvCount = 0;`;
    if (!source.includes(finalTelemetryAnchor)) throw new Error(`${path}: V7 final telemetry anchor is missing`);
    source = source.replace(
      finalTelemetryAnchor,
      `${finalTelemetryAnchor}\n      registerFleetToRenderedPavement(THREE, group, fleet, staticFleet, placements).catch((error) => {\n        group.userData.uploadedJetwayLoadState = "error";\n        group.userData.uploadedJetwayLoadError = error instanceof Error ? error.message : String(error);\n        console.error("Exact Airport_Jetway.glb authored-pavement registration failed", error);\n      });`,
    );
  }
}

for (const required of [
  marker,
  "PHX_KPHX_AuthoredAirportWideGround",
  "resolveVisibleTunnelCUndercarriage",
  "tunnelCDisconnectedComponents",
  "componentWorldBounds",
  "Tunnel_C_Jetway_0",
  "a1RigidTunnelCFinalClearanceMeters",
  "a1RigidTunnelCGroundComponentTriangles",
  "horizontalSpan >= 0.35",
  "alongRatio > 0.35 && alongRatio < 0.88",
  `group.userData.uploadedJetwayLoadState = "ground-registering";`,
  `group.userData.uploadedJetwayLoadState = "ready";`,
  "registerFleetToRenderedPavement(THREE, group, fleet, staticFleet, placements).catch",
]) {
  if (!source.includes(required)) throw new Error(`${path}: authored pavement registration V7 missing ${required}`);
}
if (source.includes(oldV6Marker)) {
  throw new Error(`${path}: stale V6 full-carrier-minimum grounding survived V7`);
}
if (source.includes(".then(async (prototype) =>")) {
  throw new Error(`${path}: V7 still blocks the GLB load promise waiting for scene attachment`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: static gates retain authored ground registration while A1 is rigidly registered from a substantial visible disconnected Tunnel-C undercarriage component, excluding tiny cable/rod minima that previously allowed the visible bogie to float.`);
