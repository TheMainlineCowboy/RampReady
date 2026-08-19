import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleet.js";
const marker = "rendered-kphx-pavement-per-gate-v3-deferred-scene-registration";
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
function findRenderedGround(group) {
  const root = rootOf(group);
  for (const name of GROUND_NAMES) {
    const ground = root?.getObjectByName?.(name) || null;
    if (ground) return ground;
  }
  return null;
}

async function waitForRenderedGround(group) {
  // The GLB load starts while buildSourcePlacedTerminal4Jetways is still
  // constructing its return value. Waiting inside that load promise deadlocks
  // scene attachment. This waiter is therefore called only AFTER fleet creation,
  // so the outer builder can return and the jetway group can join the airport.
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const ground = group.parent ? findRenderedGround(group) : null;
    if (ground) return ground;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  throw new Error("Exact jetway fleet timed out after deferred scene attachment waiting for rendered KPHX pavement");
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
  const hit = ray.intersectObject(ground, true)[0];
  if (!hit?.point) throw new Error(\`Exact jetway fleet pavement ray missed local \${x},\${z} / world \${worldProbe.x},\${worldProbe.z}\`);
  return group.worldToLocal(hit.point.clone()).y;
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
  const a1LocalGroundY = renderedPavementYAt(THREE, group, a1Placement.x, a1Placement.z, ground);
  a1Anchor.position.y = a1LocalGroundY + LEGACY_FINAL_FLEET_SHIFT_METERS;
  a1Anchor.userData.renderedPavementGroundY = a1LocalGroundY;
  a1Anchor.updateMatrix();
  fleet.updateWorldMatrix(true, true);

  group.userData.uploadedJetwayGroundRegistrationAuthority = "${marker}";
  group.userData.uploadedJetwayGroundRegisteredGateCount = registeredStaticCount + 1;
  group.userData.uploadedJetwayLoadState = "ready";
}
`;

if (!source.includes(marker)) {
  if (!source.includes(oldHelper)) throw new Error(`${path}: V3 pavement helper anchor is missing`);
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
  if (!source.includes(oldGroundMap)) throw new Error(`${path}: V3 static ground-map anchor is missing`);
  source = source.replace(oldGroundMap, initialGroundMap);

  const oldA1Ground = `          const a1GroundY = renderedPavementYAt(THREE, group, placement.x, placement.z) + LEGACY_FINAL_FLEET_SHIFT_METERS;`;
  const initialA1Ground = `          const a1GroundY = LEGACY_FINAL_FLEET_SHIFT_METERS;`;
  if (!source.includes(oldA1Ground)) throw new Error(`${path}: V3 A1 ground anchor is missing`);
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
  if (!source.includes(readyAnchor)) throw new Error(`${path}: V3 readiness anchor is missing`);
  source = source.replace(readyAnchor, `      group.userData.uploadedJetwayLoadState = "ground-registering";`);

  source = source.replace(
    `      group.userData.uploadedJetwayGroundRegistrationAuthority = "rendered-kphx-pavement-per-gate-v1";`,
    `      group.userData.uploadedJetwayGroundRegistrationAuthority = "${marker}-pending";`,
  );

  const finalTelemetryAnchor = `      group.userData.proceduralProjectedUvCount = 0;`;
  if (!source.includes(finalTelemetryAnchor)) throw new Error(`${path}: V3 final telemetry anchor is missing`);
  source = source.replace(
    finalTelemetryAnchor,
    `${finalTelemetryAnchor}\n      registerFleetToRenderedPavement(THREE, group, fleet, staticFleet, placements).catch((error) => {\n        group.userData.uploadedJetwayLoadState = "error";\n        group.userData.uploadedJetwayLoadError = error instanceof Error ? error.message : String(error);\n        console.error("Exact Airport_Jetway.glb deferred pavement registration failed", error);\n      });`,
  );
}

for (const required of [
  marker,
  "async function registerFleetToRenderedPavement",
  "group.localToWorld(new THREE.Vector3(x, 0, z))",
  "group.worldToLocal(hit.point.clone()).y",
  `group.userData.uploadedJetwayLoadState = "ground-registering";`,
  `group.userData.uploadedJetwayLoadState = "ready";`,
  "registerFleetToRenderedPavement(THREE, group, fleet, staticFleet, placements).catch",
]) {
  if (!source.includes(required)) throw new Error(`${path}: deferred pavement registration V3 missing ${required}`);
}
if (source.includes(".then(async (prototype) =>")) {
  throw new Error(`${path}: V3 still blocks the GLB load promise waiting for scene attachment`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: exact jetways are constructed first, then all 58 rigid parent/instance Y transforms are raycast-registered only after the Terminal 4 group is attached to the rendered KPHX scene; readiness is withheld until registration finishes.`);
