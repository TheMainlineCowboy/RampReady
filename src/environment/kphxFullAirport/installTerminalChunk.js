import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KPHX_TERMINAL_CHUNK } from "./terminalManifest.js";
import {
  KPHX_FULL_AIRPORT_SOURCE,
  kphxWedToRampReadyPosition,
  kphxXPlaneHeadingToRampReadyYawRadians,
} from "./sourceAuthority.js";

function prepareLoadedScene(root, placement) {
  root.name = `KPHX_FULL_${placement.name}`;
  const position = kphxWedToRampReadyPosition(
    placement.latitude,
    placement.longitude,
    placement.customMsl ? placement.mslMeters : 0,
  );
  root.position.set(position[0], position[1], position[2]);
  root.rotation.set(0, kphxXPlaneHeadingToRampReadyYawRadians(placement.headingDegrees), 0);
  root.updateMatrixWorld(true);

  root.userData = {
    ...(root.userData || {}),
    kphxFullAirport: true,
    sourcePackage: KPHX_FULL_AIRPORT_SOURCE.packageName,
    sourceVersion: KPHX_FULL_AIRPORT_SOURCE.packageVersion,
    sourceResource: placement.sourceResource,
    wedObjectId: placement.wedObjectId,
    wedLatitude: placement.latitude,
    wedLongitude: placement.longitude,
    wedHeadingDegrees: placement.headingDegrees,
    runtimePosition: position,
    runtimeYawRadians: root.rotation.y,
    geometryPolicy: KPHX_FULL_AIRPORT_SOURCE.geometryPolicy,
    placementPolicy: KPHX_FULL_AIRPORT_SOURCE.placementPolicy,
  };

  root.traverse((node) => {
    if (!node?.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
    node.userData = {
      ...(node.userData || {}),
      kphxFullAirport: true,
      kphxChunk: KPHX_TERMINAL_CHUNK.id,
      sourceResource: placement.sourceResource,
      wedObjectId: placement.wedObjectId,
    };
  });

  return root;
}

export async function installKphxFullAirportTerminalChunk(
  THREE,
  environment,
  { loader = new GLTFLoader(), strict = true } = {},
) {
  if (!environment?.add) throw new Error("KPHX full-airport terminal loader requires a Three.js environment group");

  const chunkRoot = new THREE.Group();
  chunkRoot.name = "KPHX_FULL_AIRPORT_TERMINALS";
  chunkRoot.userData = {
    kphxFullAirport: true,
    kphxChunk: KPHX_TERMINAL_CHUNK.id,
    sourceVersion: KPHX_FULL_AIRPORT_SOURCE.packageVersion,
    expectedPlacementCount: KPHX_TERMINAL_CHUNK.placements.length,
    loadedPlacementCount: 0,
    failures: [],
  };
  environment.add(chunkRoot);

  const outcomes = await Promise.all(KPHX_TERMINAL_CHUNK.placements.map(async (placement) => {
    try {
      const gltf = await loader.loadAsync(placement.assetUrl);
      if (!gltf?.scene) throw new Error("glTF loaded without a scene root");
      const root = prepareLoadedScene(gltf.scene, placement);
      chunkRoot.add(root);
      return { ok: true, placement, root };
    } catch (error) {
      const failure = {
        wedObjectId: placement.wedObjectId,
        name: placement.name,
        sourceResource: placement.sourceResource,
        assetUrl: placement.assetUrl,
        message: error instanceof Error ? error.message : String(error),
      };
      chunkRoot.userData.failures.push(failure);
      if (strict) throw Object.assign(new Error(`KPHX terminal asset failed: ${placement.name}: ${failure.message}`), { failure });
      return { ok: false, placement, failure };
    }
  }));

  const loaded = outcomes.filter((entry) => entry.ok);
  chunkRoot.userData.loadedPlacementCount = loaded.length;
  chunkRoot.userData.ready = loaded.length === KPHX_TERMINAL_CHUNK.placements.length;

  if (strict && !chunkRoot.userData.ready) {
    throw new Error(`KPHX terminal chunk incomplete: ${loaded.length}/${KPHX_TERMINAL_CHUNK.placements.length}`);
  }

  environment.userData = {
    ...(environment.userData || {}),
    kphxFullAirportTerminals: {
      chunkId: KPHX_TERMINAL_CHUNK.id,
      ready: chunkRoot.userData.ready,
      expectedPlacementCount: KPHX_TERMINAL_CHUNK.placements.length,
      loadedPlacementCount: loaded.length,
      failures: [...chunkRoot.userData.failures],
      sourceVersion: KPHX_FULL_AIRPORT_SOURCE.packageVersion,
    },
  };

  return {
    root: chunkRoot,
    outcomes,
    ready: chunkRoot.userData.ready,
  };
}
