import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { applyExactXp11Obj8MaskCompatibility } from "../environment/kphxFullAirport/obj8RenderCompatibility.js";
import { preparePlacementRoot } from "../environment/kphxFullAirport/installPackageOwnedObjectLayer.js";
import { KPHX_EXACT_RECOVERED_ASSETS } from "../environment/kphxFullAirport/exactAssetCatalog.js";

const STRUCTURES_MANIFEST_URL = "/models/kphx-full-airport/batches/structures.manifest.json";
const T3_RESOURCE = "Terminals/Terminal3a.obj";
const EXPECTED = Object.freeze({
  wedObjectId: "7424",
  latitude: 33.436168819,
  longitude: -112.008763064,
  headingDegrees: 0,
  assetUrl: "/models/kphx/Terminal3a.exact.glb",
});

function runtimeUrl(url) {
  if (!url || !url.startsWith("/")) return url;
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  if (!base || base === "/") return url;
  if (url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

function exactNumber(value, expected, label) {
  if (Number(value) !== Number(expected)) {
    throw new Error(`${label} changed: ${value} !== ${expected}`);
  }
}

export default function KphxT3BuildingShellVerifier() {
  const mountRef = useRef(null);
  const [status, setStatus] = useState("Loading exact Terminal 3 building shell…");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb8d0e4);
    scene.fog = new THREE.Fog(0xb8d0e4, 1100, 4200);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 6000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "kphxT3BuildingShellVerifierCanvas";
    renderer.domElement.dataset.kphxT3BuildingShellVerifier = "loading";
    mount.appendChild(renderer.domElement);

    const environment = new THREE.Group();
    environment.name = "KPHX_T3_BUILDING_SHELL_QA";
    scene.add(environment);

    scene.add(new THREE.HemisphereLight(0xf5f8ff, 0x6f685d, 2.0));
    const sun = new THREE.DirectionalLight(0xffffff, 3.0);
    sun.position.set(450, 650, 250);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -1200;
    sun.shadow.camera.right = 1200;
    sun.shadow.camera.top = 1200;
    sun.shadow.camera.bottom = -1200;
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
      const startedAt = performance.now();
      setStatus("Loading exact Terminal 3 shell · WED 7424…");

      const manifestResponse = await fetch(runtimeUrl(STRUCTURES_MANIFEST_URL), { cache: "no-cache" });
      if (!manifestResponse.ok) throw new Error(`T3 structures manifest HTTP ${manifestResponse.status}`);
      const manifest = await manifestResponse.json();

      if (manifest?.source?.version !== "1.75.1") {
        throw new Error(`T3 structures source version changed: ${manifest?.source?.version || "unknown"}`);
      }
      if ((manifest.failures || []).length !== 0) {
        throw new Error(`Structures manifest has ${manifest.failures.length} materialization failures`);
      }

      const placements = (manifest.packageOwned?.placements || []).filter(
        (placement) => placement.resource === T3_RESOURCE,
      );
      if (placements.length !== 1) {
        throw new Error(`Expected 1 exact Terminal3a placement, found ${placements.length}`);
      }

      const placement = placements[0];
      const catalog = KPHX_EXACT_RECOVERED_ASSETS.singleResourceAssets[T3_RESOURCE];
      if (!catalog) throw new Error("Missing exact Terminal3a recovered-asset authority");

      if (String(placement.id) !== EXPECTED.wedObjectId || String(catalog.wedObjectId) !== EXPECTED.wedObjectId) {
        throw new Error(`Terminal3a WED object changed: manifest=${placement.id} catalog=${catalog.wedObjectId}`);
      }
      if (placement.assetUrl !== EXPECTED.assetUrl || catalog.assetUrl !== EXPECTED.assetUrl) {
        throw new Error(`Terminal3a runtime asset changed: manifest=${placement.assetUrl} catalog=${catalog.assetUrl}`);
      }
      if (placement.recoveredExact !== true) {
        throw new Error("Terminal3a is no longer marked recoveredExact");
      }
      exactNumber(placement.latitude, EXPECTED.latitude, "Terminal3a latitude");
      exactNumber(placement.longitude, EXPECTED.longitude, "Terminal3a longitude");
      exactNumber(placement.headingDegrees, EXPECTED.headingDegrees, "Terminal3a heading");

      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(runtimeUrl(placement.assetUrl));
      if (!gltf?.scene) throw new Error("Terminal3a exact GLB loaded without a scene root");

      applyExactXp11Obj8MaskCompatibility(THREE, gltf.scene, {
        label: T3_RESOURCE,
        alphaCutoff: 0.5,
        windingAlreadyConverted: false,
        correctLegacyTextureV: true,
      });
      const root = preparePlacementRoot(gltf.scene, placement);
      environment.add(root);

      const bounds = new THREE.Box3().setFromObject(root);
      if (bounds.isEmpty()) throw new Error("Terminal3a exact shell produced empty render bounds");

      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const longAxisX = size.x >= size.z;
      const facadeDistance = Math.max(125, (longAxisX ? size.x : size.z) * 0.78);
      const position = longAxisX
        ? new THREE.Vector3(
          center.x + size.x * 0.06,
          Math.max(center.y + 15, size.y * 0.72),
          center.z + facadeDistance,
        )
        : new THREE.Vector3(
          center.x + facadeDistance,
          Math.max(center.y + 15, size.y * 0.72),
          center.z + size.z * 0.06,
        );
      const target = new THREE.Vector3(center.x, Math.max(4, center.y + size.y * 0.12), center.z);

      camera.position.copy(position);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);

      renderer.domElement.dataset.kphxT3BuildingShellVerifier = "ready";
      renderer.domElement.dataset.kphxT3BuildingPlacements = "1";
      renderer.domElement.dataset.kphxT3Resource = T3_RESOURCE;
      renderer.domElement.dataset.kphxT3WedObjectId = String(placement.id);
      renderer.domElement.dataset.kphxT3Latitude = String(placement.latitude);
      renderer.domElement.dataset.kphxT3Longitude = String(placement.longitude);
      renderer.domElement.dataset.kphxT3HeadingDegrees = String(placement.headingDegrees);
      renderer.domElement.dataset.kphxT3Asset = placement.assetUrl;
      renderer.domElement.dataset.kphxT3RecoveredExact = String(placement.recoveredExact === true);
      renderer.domElement.dataset.kphxT3SourceSha256 = String(catalog.sourceSha256 || "");
      renderer.domElement.dataset.kphxT3RuntimeSha256 = String(catalog.runtimeSha256 || "");
      renderer.domElement.dataset.kphxT3RuntimeBytes = String(catalog.runtimeBytes || "");
      renderer.domElement.dataset.kphxT3BoundsSize = size.toArray().join(",");
      renderer.domElement.dataset.kphxT3CameraPosition = position.toArray().join(",");
      renderer.domElement.dataset.kphxT3CameraTarget = target.toArray().join(",");
      renderer.domElement.dataset.kphxT3SubstitutionPolicy = "none";
      renderer.domElement.dataset.kphxT3LegacyMaskCompatibility = "true";
      renderer.domElement.dataset.kphxT3WindingReversal = "true";
      renderer.domElement.dataset.kphxT3LegacyTextureVCorrection = "true";
      renderer.domElement.dataset.kphxT3GeometryEdits = "0";
      renderer.domElement.dataset.kphxT3PlacementEdits = "0";
      renderer.domElement.dataset.kphxT3LoadMs = String(Math.round(performance.now() - startedAt));

      setStatus("Exact Terminal 3 shell ready · WED 7424 · one source building · no substitutions");
    };

    load().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      renderer.domElement.dataset.kphxT3BuildingShellVerifier = "error";
      renderer.domElement.dataset.kphxT3BuildingShellVerifierError = message;
      setStatus(`T3 building-shell verifier failed: ${message}`);
      console.error("KPHX T3 building-shell verifier failed", error);
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
          maxWidth: "min(92vw, 720px)",
        }}
      >
        {status}
      </div>
    </main>
  );
}
