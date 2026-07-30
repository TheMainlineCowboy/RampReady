export const KPHX_RUNWAY_VISUAL_PROFILE = Object.freeze({
  source: "models/kphx-ground/runtime-manifest.json",
  expectedRunwayCount: 3,
  detailLevel: "source-runway-identifiers-threshold-and-lighting-v1",
  coordinateFrame: "A1-local; X=north, Y=up, Z=east",
});

function stabilizeAuthoredConcreteMaterial(THREE, authoredGround) {
  let stabilizedConcreteMaterialCount = 0;
  authoredGround.traverse((node) => {
    if (!node.isMesh) return;
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    let changed = false;
    const stabilizedMaterials = sourceMaterials.map((material) => {
      if (!material || material.name !== "concrete") return material;
      if (!material.map) throw new Error("KPHX concrete stabilization requires the generated source slab texture");
      const replacement = new THREE.MeshBasicMaterial({
        name: material.name,
        map: material.map,
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: false,
        opacity: 1,
        alphaTest: 0,
        depthWrite: true,
        depthTest: true,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: material.polygonOffsetFactor ?? -0.25,
        polygonOffsetUnits: material.polygonOffsetUnits ?? -0.5,
      });
      replacement.userData = {
        ...(material.userData || {}),
        concreteRenderingAuthority: "source-textured-unlit-concrete-v1-no-black-lighting-polygons",
      };
      replacement.needsUpdate = true;
      changed = true;
      stabilizedConcreteMaterialCount += 1;
      return replacement;
    });
    if (!changed) return;
    node.material = Array.isArray(node.material) ? stabilizedMaterials : stabilizedMaterials[0];
    node.receiveShadow = false;
  });
  if (stabilizedConcreteMaterialCount < 1) {
    throw new Error("KPHX concrete stabilization did not find the authored concrete material");
  }
  authoredGround.userData.stabilizedConcreteMaterialCount = stabilizedConcreteMaterialCount;
  authoredGround.userData.concreteRenderingAuthority = "source-textured-unlit-concrete-v1-no-black-lighting-polygons";
  return stabilizedConcreteMaterialCount;
}

async function loadManifest() {
  const url = new URL(`${import.meta.env.BASE_URL}${KPHX_RUNWAY_VISUAL_PROFILE.source}`, window.location.href);
  url.searchParams.set("detail", KPHX_RUNWAY_VISUAL_PROFILE.detailLevel);
  const response = await fetch(url.href, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!response.ok) throw new Error(`KPHX runway manifest returned HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.schemaVersion !== 2 || manifest.runways?.length !== KPHX_RUNWAY_VISUAL_PROFILE.expectedRunwayCount) {
    throw new Error("KPHX runway manifest is incomplete");
  }
  return manifest;
}

function makeRunwayIdentifierTexture(THREE, identifier) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("KPHX runway identifier canvas is unavailable");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f7f7f3";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const compact = identifier.length > 2;
  context.font = `900 ${compact ? 205 : 230}px Arial Black, Arial, sans-serif`;
  context.fillText(identifier, canvas.width / 2, canvas.height / 2 + 5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `KPHX runway ${identifier} identifier`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function buildIdentifier(THREE, label, runwayWidth) {
  const texture = makeRunwayIdentifierTexture(THREE, label.ident);
  const geometry = new THREE.PlaneGeometry(Math.min(15, runwayWidth * 0.32), Math.min(10, runwayWidth * 0.22));
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.12,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -0.25,
    polygonOffsetUnits: -0.5,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `KPHX_RunwayIdentifier_${label.ident}`;
  mesh.position.set(label.x, 0.003, label.z);
  mesh.rotation.y = -THREE.MathUtils.degToRad(label.headingDegrees) - Math.PI / 2;
  mesh.renderOrder = 520;
  mesh.userData.sourceRunwayIdentifier = label.ident;
  return mesh;
}

function addLight(instances, x, z, color, role) {
  instances.push({ x, z, color, role });
}

function collectRunwayLights(runway) {
  const instances = [];
  const radians = runway.headingDegrees * Math.PI / 180;
  const along = [Math.cos(radians), Math.sin(radians)];
  const across = [-along[1], along[0]];
  const center = [runway.center.x, runway.center.z];
  const point = (longitudinal, lateral = 0) => [
    center[0] + along[0] * longitudinal + across[0] * lateral,
    center[1] + along[1] * longitudinal + across[1] * lateral,
  ];
  const halfLength = runway.lengthMeters / 2;
  const halfWidth = runway.widthMeters / 2;
  if (runway.edgeLightIntensity > 0) {
    for (let distance = -halfLength; distance <= halfLength; distance += 60) {
      for (const side of [-1, 1]) {
        const [x, z] = point(distance, side * (halfWidth - 0.55));
        addLight(instances, x, z, 0xf4f0d8, "runway-edge");
      }
    }
  }
  if (runway.centerLightIntensity > 0) {
    for (let distance = -halfLength + 15; distance <= halfLength - 15; distance += 30) {
      const remaining = halfLength - Math.abs(distance);
      const red = runway.centerLightsRedAtEnd && remaining < 300;
      const [x, z] = point(distance);
      addLight(instances, x, z, red ? 0xff2a22 : 0xf7f4de, red ? "runway-center-red" : "runway-center");
    }
  }
  for (const threshold of [
    { value: runway.primaryThreshold, inward: 1 },
    { value: runway.secondaryThreshold, inward: -1 },
  ]) {
    for (let lateral = -halfWidth + 1.4; lateral <= halfWidth - 1.4; lateral += 3.2) {
      const x = threshold.value.x + across[0] * lateral;
      const z = threshold.value.z + across[1] * lateral;
      addLight(instances, x, z, 0x42ff7b, "runway-threshold-green");
      const outwardX = x - along[0] * threshold.inward * 1.1;
      const outwardZ = z - along[1] * threshold.inward * 1.1;
      addLight(instances, outwardX, outwardZ, 0xff332b, "runway-end-red");
    }
  }
  return instances;
}

function buildLightMeshes(THREE, runways) {
  const all = runways.flatMap(collectRunwayLights);
  const geometry = new THREE.SphereGeometry(0.105, 10, 6);
  const byColor = new Map();
  for (const entry of all) {
    const records = byColor.get(entry.color) ?? [];
    records.push(entry);
    byColor.set(entry.color, records);
  }
  const group = new THREE.Group();
  group.name = "KPHX_SourceRunwayLighting";
  const dummy = new THREE.Object3D();
  for (const [color, records] of byColor) {
    const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    mesh.name = `KPHX_RunwayLights_${color.toString(16)}`;
    records.forEach((record, index) => {
      dummy.position.set(record.x, 0.16, record.z);
      dummy.scale.setScalar(record.role.includes("threshold") || record.role.includes("end-red") ? 1.25 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = true;
    mesh.renderOrder = 530;
    mesh.userData.sourceRunwayLightCount = records.length;
    group.add(mesh);
  }
  group.userData.lightCount = all.length;
  return group;
}

export async function installKphxRunwayVisuals(THREE, authoredGround) {
  if (!authoredGround?.isObject3D) throw new Error("KPHX authored ground is required for runway visuals");
  if (!authoredGround.userData.concreteRenderingAuthority) stabilizeAuthoredConcreteMaterial(THREE, authoredGround);
  if (authoredGround.userData.kphxRunwayVisuals) return authoredGround.userData.kphxRunwayVisuals;
  const manifest = await loadManifest();
  const group = new THREE.Group();
  group.name = "KPHX_SourceRunwayIdentifiersAndLights";
  for (const runway of manifest.runways) {
    for (const label of runway.labels) group.add(buildIdentifier(THREE, label, runway.widthMeters));
  }
  const lights = buildLightMeshes(THREE, manifest.runways);
  group.add(lights);
  group.userData.lightCount = lights.userData.lightCount;
  group.userData.runwayCount = manifest.runways.length;
  group.userData.identifierCount = manifest.runways.length * 2;
  group.userData.detailLevel = KPHX_RUNWAY_VISUAL_PROFILE.detailLevel;
  group.userData.concreteRenderingAuthority = authoredGround.userData.concreteRenderingAuthority;
  group.userData.stabilizedConcreteMaterialCount = authoredGround.userData.stabilizedConcreteMaterialCount;
  group.userData.runways = manifest.runways.map(({ primary, secondary, lengthMeters, widthMeters, headingDegrees }) => ({ primary, secondary, lengthMeters, widthMeters, headingDegrees }));
  authoredGround.add(group);
  authoredGround.userData.kphxRunwayVisuals = group;
  return group;
}
