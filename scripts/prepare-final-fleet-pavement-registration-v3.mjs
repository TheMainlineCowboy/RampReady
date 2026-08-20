import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleet.js";
const marker = "rendered-kphx-pavement-per-gate-v6-a1-tunnel-c-rigid-ground-registration";
let source = fs.readFileSync(path, "utf8");

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

function registerA1RigidlyFromTunnelC(THREE, group, fleet, a1Anchor, ground, fallbackGroundY) {
  fleet.updateWorldMatrix(true, true);
  const carrier = a1Anchor.getObjectByName("Tunnel_C_Jetway_0");
  if (!carrier?.isMesh) throw new Error("A1 rigid pavement registration cannot resolve Tunnel_C_Jetway_0");
  carrier.updateWorldMatrix(true, false);
  let carrierBox = new THREE.Box3().setFromObject(carrier);
  if (carrierBox.isEmpty()) throw new Error("A1 Tunnel-C carrier bounds are empty during rigid pavement registration");
  let centerWorld = carrierBox.getCenter(new THREE.Vector3());
  let centerLocal = group.worldToLocal(centerWorld.clone());
  const carrierGroundY = renderedPavementYAt(THREE, group, centerLocal.x, centerLocal.z, ground);
  const bottomLocalY = group.worldToLocal(new THREE.Vector3(centerWorld.x, carrierBox.min.y, centerWorld.z)).y;
  const correction = carrierGroundY - bottomLocalY + 0.01;
  if (!Number.isFinite(correction) || Math.abs(correction) > 2.0) {
    throw new Error(\`A1 rigid Tunnel-C grounding correction is implausible: \${correction} m (carrierBottom=\${bottomLocalY}, ramp=\${carrierGroundY}, fallbackRamp=\${fallbackGroundY})\`);
  }
  a1Anchor.position.y += correction;
  a1Anchor.updateMatrix();
  fleet.updateWorldMatrix(true, true);

  carrierBox = new THREE.Box3().setFromObject(carrier);
  centerWorld = carrierBox.getCenter(new THREE.Vector3());
  centerLocal = group.worldToLocal(centerWorld.clone());
  const finalGroundY = renderedPavementYAt(THREE, group, centerLocal.x, centerLocal.z, ground);
  const finalBottomLocalY = group.worldToLocal(new THREE.Vector3(centerWorld.x, carrierBox.min.y, centerWorld.z)).y;
  const finalClearance = finalBottomLocalY - finalGroundY;
  if (!Number.isFinite(finalClearance) || Math.abs(finalClearance - 0.01) > 0.015) {
    throw new Error(\`A1 rigid Tunnel-C registration missed pavement: clearance=\${finalClearance} m\`);
  }
  a1Anchor.userData.renderedPavementGroundY = finalGroundY;
  a1Anchor.userData.a1RigidTunnelCGroundCorrectionMeters = correction;
  a1Anchor.userData.a1RigidTunnelCFinalClearanceMeters = finalClearance;
  a1Anchor.userData.a1RigidTunnelCGroundAuthority = "${marker}";
  return { correction, clearance: finalClearance, groundY: finalGroundY };
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

if (!source.includes(marker)) {
  if (!source.includes(oldHelper)) throw new Error(`${path}: V6 pavement helper anchor is missing`);
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
  if (!source.includes(oldGroundMap)) throw new Error(`${path}: V6 static ground-map anchor is missing`);
  source = source.replace(oldGroundMap, initialGroundMap);

  const oldA1Ground = `          const a1GroundY = renderedPavementYAt(THREE, group, placement.x, placement.z) + LEGACY_FINAL_FLEET_SHIFT_METERS;`;
  const initialA1Ground = `          const a1GroundY = LEGACY_FINAL_FLEET_SHIFT_METERS;`;
  if (!source.includes(oldA1Ground)) throw new Error(`${path}: V6 A1 ground anchor is missing`);
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
  if (!source.includes(readyAnchor)) throw new Error(`${path}: V6 readiness anchor is missing`);
  source = source.replace(readyAnchor, `      group.userData.uploadedJetwayLoadState = "ground-registering";`);
  source = source.replace(
    `      group.userData.uploadedJetwayGroundRegistrationAuthority = "rendered-kphx-pavement-per-gate-v1";`,
    `      group.userData.uploadedJetwayGroundRegistrationAuthority = "${marker}-pending";`,
  );

  const finalTelemetryAnchor = `      group.userData.proceduralProjectedUvCount = 0;`;
  if (!source.includes(finalTelemetryAnchor)) throw new Error(`${path}: V6 final telemetry anchor is missing`);
  source = source.replace(
    finalTelemetryAnchor,
    `${finalTelemetryAnchor}\n      registerFleetToRenderedPavement(THREE, group, fleet, staticFleet, placements).catch((error) => {\n        group.userData.uploadedJetwayLoadState = "error";\n        group.userData.uploadedJetwayLoadError = error instanceof Error ? error.message : String(error);\n        console.error("Exact Airport_Jetway.glb authored-pavement registration failed", error);\n      });`,
  );
}

for (const required of [
  marker,
  "PHX_KPHX_AuthoredAirportWideGround",
  "registerA1RigidlyFromTunnelC",
  "Tunnel_C_Jetway_0",
  "a1RigidTunnelCFinalClearanceMeters",
  `group.userData.uploadedJetwayLoadState = "ground-registering";`,
  `group.userData.uploadedJetwayLoadState = "ready";`,
  "registerFleetToRenderedPavement(THREE, group, fleet, staticFleet, placements).catch",
]) {
  if (!source.includes(required)) throw new Error(`${path}: authored pavement registration V6 missing ${required}`);
}
if (source.includes(".then(async (prototype) =>")) {
  throw new Error(`${path}: V6 still blocks the GLB load promise waiting for scene attachment`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: static gates retain authored ground registration while A1 is rigidly lowered/raised as one intact supplied assembly until the final Tunnel-C carrier sits 1 cm above the rendered KPHX pavement.`);
