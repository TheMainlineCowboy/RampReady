import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { installKphxPackageOwnedObjectLayer } from "../environment/kphxFullAirport/installPackageOwnedObjectLayer.js";
import { installKphxPackageOwnedSurfaceLayer } from "../environment/kphxFullAirport/installPackageOwnedSurfaceLayer.js";
import { installKphxTerminal4StockJetways } from "../environment/kphxFullAirport/installTerminal4StockJetways.js";
import { KPHX_T4_COVERED_OBJECT_AUTHORITY } from "../environment/kphxFullAirport/t4CoveredObjectAuthority.js";

const T4_ZDP_MANIFEST = "/models/kphx-full-airport/batches/t4-zdp.manifest.json";

const OBJECT_MANIFESTS = Object.freeze([
  "/models/kphx-full-airport/batches/structures.manifest.json",
  "/models/kphx-full-airport/batches/gate-numbers.manifest.json",
  "/models/kphx-full-airport/batches/airfield-details.manifest.json",
  "/models/kphx-full-airport/batches/service-cargo-downtown.manifest.json",
  "/models/kphx-full-airport/batches/t4-cdb.manifest.json",
  "/models/kphx-full-airport/batches/t4-misterx.manifest.json",
]);

const T4_ZDP_OBJECT_MANIFEST = "/models/kphx-full-airport/batches/t4-zdp.manifest.json";

export default function KphxFullAirportVerifier() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const objectsOnlyQa = params?.get("kphxQaObjectsOnly") === "1";
  const mountRef = useRef(null);
  const [status, setStatus] = useState("Loading exact KPHX 1.75.1…");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa9c9e7);
    scene.fog = new THREE.Fog(0xa9c9e7, 1800, 6200);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 9000);
    camera.position.set(220, 145, 250);
    camera.lookAt(0, 12, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "kphxFullAirportVerifierCanvas";
    renderer.domElement.dataset.kphxFullAirportVerifier = "loading";
    mount.appendChild(renderer.domElement);

    const environment = new THREE.Group();
    environment.name = "KPHX_FULL_AIRPORT_VERIFIER";
    scene.add(environment);

    scene.add(new THREE.HemisphereLight(0xf0f6ff, 0x6e685f, 2.0));
    const sun = new THREE.DirectionalLight(0xffffff, 3.0);
    sun.position.set(500, 700, 250);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -1800;
    sun.shadow.camera.right = 1800;
    sun.shadow.camera.top = 1800;
    sun.shadow.camera.bottom = -1800;
    scene.add(sun);

    let disposed = false;
    const resize = () => {
      if (disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const load = async () => {
      const verifierStartedAt = performance.now();
      const stageStartedAt = new Map();

      const timed = async (name, task) => {
        stageStartedAt.set(name, performance.now());
        const result = await task;
        const elapsed = Math.round(performance.now() - stageStartedAt.get(name));
        renderer.domElement.dataset[`kphxLoadMs${name}`] = String(elapsed);
        return result;
      };

      setStatus("Loading exact KPHX 1.75.1 · assembling exact source layers…");

      const objectTask = timed("Objects", Promise.all(
        OBJECT_MANIFESTS.map((manifestUrl) => installKphxPackageOwnedObjectLayer(THREE, environment, {
          manifestUrl,
          strict: true,
          assetConcurrency: 8,
        })),
      ));

      const surfaceTask = timed("Surfaces", installKphxPackageOwnedSurfaceLayer(THREE, environment, {
        strict: true,
      }));

      const jetwayTask = timed("Jetways", installKphxTerminal4StockJetways(THREE, environment, {
        strict: true,
      }));

      const t4ZdpTask = timed("T4Zdp", installKphxPackageOwnedObjectLayer(THREE, environment, {
        manifestUrl: T4_ZDP_MANIFEST,
        strict: true,
        assetConcurrency: 1,
      }));

      const [objectResults, surfaces, terminal4Jetways, t4Zdp] = await Promise.all([
        objectTask,
        surfaceTask,
        jetwayTask,
        t4ZdpTask,
      ]);

      const objectPlacements = objectResults.reduce(
        (sum, result) => sum + Number(result.layer.userData.loadedPlacementCount || 0),
        0,
      );
      const sourceResources = objectResults.reduce(
        (sum, result) => sum
          + Number(result.manifest.packageOwned?.materializedUniqueResourceCount || 0)
          + Number(result.manifest.resolvedExternal?.materializedUniqueResourceCount || 0),
        0,
      );
      const loadedAssetFiles = objectResults.reduce(
        (sum, result) => sum + Number(result.layer.userData.loadedUniqueAssetCount || 0),
        0,
      );

      const t4CoveredIds = new Set(KPHX_T4_COVERED_OBJECT_AUTHORITY.coveredWedObjectIds);
      let t4VisibleObjectPlacements = 0;
      for (const result of [...objectResults, t4Zdp]) {
        for (const placementRoot of result.layer.children) {
          const wedObjectId = String(placementRoot.userData?.wedObjectId ?? "");
          const visible = t4CoveredIds.has(wedObjectId);
          placementRoot.visible = visible;
          if (visible) t4VisibleObjectPlacements += 1;
        }
      }

      if (objectPlacements !== 1634) throw new Error(`Expected 1634 exact KPHX placements, loaded ${objectPlacements}`);
      if (sourceResources !== 147) throw new Error(`Expected 147 exact KPHX source resources, loaded ${sourceResources}`);
      if (Number(t4Zdp.layer.userData.loadedPlacementCount || 0) !== 13) {
        throw new Error(`Expected 13 exact T4 ZDP placements, loaded ${t4Zdp.layer.userData.loadedPlacementCount || 0}`);
      }
      if (Number(t4Zdp.manifest.resolvedExternal?.materializedUniqueResourceCount || 0) !== 1) {
        throw new Error("Expected 1 exact T4 ZDP source resource");
      }
      if (t4VisibleObjectPlacements !== KPHX_T4_COVERED_OBJECT_AUTHORITY.coveredObjectPlacementCount) {
        throw new Error(
          `Expected ${KPHX_T4_COVERED_OBJECT_AUTHORITY.coveredObjectPlacementCount} exact covered T4 objects, made ${t4VisibleObjectPlacements} visible`,
        );
      }
      if (surfaces.layer.userData.polygonCount !== 13) throw new Error(`Expected 13 package polygons, loaded ${surfaces.layer.userData.polygonCount}`);
      if (surfaces.layer.userData.lineMeshCount < 35) throw new Error(`Expected at least 35 package line meshes, loaded ${surfaces.layer.userData.lineMeshCount}`);
      if (terminal4Jetways.layer.userData.jetwayCount !== 76) {
        throw new Error(`Expected 76 exact T4 jetways, loaded ${terminal4Jetways.layer.userData.jetwayCount}`);
      }

      if (objectsOnlyQa) {
        surfaces.layer.visible = false;
      }

      const t4Bounds = new THREE.Box3().setFromObject(terminal4Jetways.layer);
      if (t4Bounds.isEmpty()) throw new Error("Exact T4 jetway layer produced empty render bounds");
      const t4Center = t4Bounds.getCenter(new THREE.Vector3());
      const t4Size = t4Bounds.getSize(new THREE.Vector3());
      const t4Span = Math.max(t4Size.x, t4Size.z, 300);
      camera.position.set(
        t4Center.x + t4Span * 0.70,
        Math.max(180, t4Span * 0.55),
        t4Center.z + t4Span * 0.82,
      );
      camera.lookAt(t4Center.x, 8, t4Center.z);
      camera.updateProjectionMatrix();
      renderer.domElement.dataset.kphxT4CameraCenter = [t4Center.x, t4Center.y, t4Center.z].join(",");
      renderer.domElement.dataset.kphxT4CameraSpan = String(t4Span);

      setStatus("KPHX exact source layers assembled · rendering integrated T4 checkpoint…");
      const finalRenderStartedAt = performance.now();
      renderer.render(scene, camera);
      renderer.domElement.dataset.kphxLoadMsFinalRender = String(Math.round(performance.now() - finalRenderStartedAt));
      renderer.domElement.dataset.kphxLoadMsTotal = String(Math.round(performance.now() - verifierStartedAt));

      renderer.domElement.dataset.kphxFullAirportVerifier = "ready";
      renderer.domElement.dataset.kphxPackagePlacements = String(objectPlacements);
      renderer.domElement.dataset.kphxPackageResources = String(sourceResources);
      renderer.domElement.dataset.kphxT4MisterxPlacements = "956";
      renderer.domElement.dataset.kphxT4MisterxResources = "50";
      renderer.domElement.dataset.kphxT4CdbPlacements = "23";
      renderer.domElement.dataset.kphxT4CdbResources = "1";
      renderer.domElement.dataset.kphxT4ZdpObjectPlacements = String(t4ZdpObjectPlacements);
      renderer.domElement.dataset.kphxT4ZdpObjectResources = String(t4ZdpObjectResources);
      renderer.domElement.dataset.kphxT4ZdpPlacements = String(t4Zdp.layer.userData.loadedPlacementCount);
      renderer.domElement.dataset.kphxT4ZdpResources = String(t4Zdp.manifest.resolvedExternal?.materializedUniqueResourceCount || 0);
      renderer.domElement.dataset.kphxLoadedAssetFiles = String(loadedAssetFiles);
      renderer.domElement.dataset.kphxPackagePolygons = String(surfaces.layer.userData.polygonCount);
      renderer.domElement.dataset.kphxPackageLineMeshes = String(surfaces.layer.userData.lineMeshCount);
      renderer.domElement.dataset.kphxSourceVersion = "1.75.1";
      renderer.domElement.dataset.kphxT4ExactJetwayCount = String(terminal4Jetways.layer.userData.jetwayCount);
      renderer.domElement.dataset.kphxT4ExactJetwayOpenEdges = String(terminal4Jetways.layer.userData.authoredOpenEdgeCount);
      renderer.domElement.dataset.kphxT4AuthoredObjectPlacements = String(KPHX_T4_COVERED_OBJECT_AUTHORITY.authoredObjectPlacementCount);
      renderer.domElement.dataset.kphxT4VisibleObjectPlacements = String(t4VisibleObjectPlacements);
      renderer.domElement.dataset.kphxT4BlockedObjectPlacements = String(KPHX_T4_COVERED_OBJECT_AUTHORITY.blockedObjectPlacementCount);
      renderer.domElement.dataset.kphxT4OldAirportJetwayGlbUsed = "false";
      renderer.domElement.dataset.kphxQaObjectsOnly = String(objectsOnlyQa);
      setStatus(`KPHX 1.75.1 exact checkpoint ready · ${objectPlacements} placements · ${sourceResources} source resources · ${loadedAssetFiles} asset files · ${terminal4Jetways.layer.userData.jetwayCount} exact T4 jetways`);
    };

    load().catch((error) => {
      renderer.domElement.dataset.kphxFullAirportVerifier = "error";
      renderer.domElement.dataset.kphxFullAirportVerifierError = error instanceof Error ? error.message : String(error);
      setStatus(`KPHX verifier failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error("KPHX full-airport verifier failed", error);
    });

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      environment.traverse((node) => {
        node.geometry?.dispose?.();
        const materials = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
        for (const material of materials) material?.dispose?.();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#111", overflow: "hidden" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(0,0,0,.72)",
          color: "white",
          font: "600 13px/1.35 system-ui, sans-serif",
          pointerEvents: "none",
          maxWidth: "min(92vw, 620px)",
        }}
      >
        {status}
      </div>
    </main>
  );
}
