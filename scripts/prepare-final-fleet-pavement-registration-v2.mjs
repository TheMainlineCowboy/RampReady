import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleet.js";
const marker = "rendered-kphx-pavement-per-gate-v2-scene-ready";
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
  // buildSourcePlacedTerminal4Jetways starts the GLB load before its returned
  // group is attached to the environment. Do not fall back to world Y=0. Wait
  // for the real scene hierarchy/pavement to exist, then register the rigid fleet.
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const ground = group.parent ? findRenderedGround(group) : null;
    if (ground) return ground;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  throw new Error("Exact jetway fleet timed out waiting for rendered KPHX pavement scene attachment");
}

function renderedPavementYAt(THREE, group, x, z, ground = findRenderedGround(group)) {
  if (!ground) throw new Error(\`Exact jetway fleet cannot resolve rendered KPHX pavement at \${x},\${z}\`);
  group.updateWorldMatrix(true, false);
  ground.updateWorldMatrix(true, true);
  // Placement x/z are local to the Terminal 4 jetway group. Convert them to
  // world coordinates for the pavement ray, then convert the hit Y back into
  // the same local frame used by the exact-GLB instance matrices.
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
}`;

if (!source.includes(marker)) {
  if (!source.includes(oldHelper)) throw new Error(`${path}: V2 pavement helper anchor is missing`);
  source = source.replace(oldHelper, newHelper);

  const thenAnchor = `  loadExactPrototype(THREE)\n    .then((prototype) => {\n      const reach = measurePrototypeReach(THREE, prototype);`;
  const thenReplacement = `  loadExactPrototype(THREE)\n    .then(async (prototype) => {\n      await waitForRenderedGround(group);\n      const reach = measurePrototypeReach(THREE, prototype);`;
  if (!source.includes(thenAnchor)) throw new Error(`${path}: exact prototype load anchor is missing`);
  source = source.replace(thenAnchor, thenReplacement);

  source = source.replace(
    'group.userData.uploadedJetwayGroundRegistrationAuthority = "rendered-kphx-pavement-per-gate-v1";',
    `group.userData.uploadedJetwayGroundRegistrationAuthority = "${marker}";`,
  );
}

for (const required of [
  marker,
  "async function waitForRenderedGround",
  "group.localToWorld(new THREE.Vector3(x, 0, z))",
  "group.worldToLocal(hit.point.clone()).y",
  ".then(async (prototype) => {",
  "await waitForRenderedGround(group);",
]) {
  if (!source.includes(required)) throw new Error(`${path}: final pavement registration V2 missing ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: all 58 exact jetways wait for the rendered airport scene, raycast pavement in world space using each gate's true group transform, then rigidly register that pavement Y back into the jetway-local frame.`);
