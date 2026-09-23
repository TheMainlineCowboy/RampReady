import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { installKphxPackageOwnedSurfaceLayer } from "../environment/kphxFullAirport/installPackageOwnedSurfaceLayer.js";
import { installKphxTerminal4StockJetways } from "../environment/kphxFullAirport/installTerminal4StockJetways.js";
import { applyExactXp11Obj8MaskCompatibility } from "../environment/kphxFullAirport/obj8RenderCompatibility.js";
import { preparePlacementRoot } from "../environment/kphxFullAirport/installPackageOwnedObjectLayer.js";
import { KPHX_EXACT_RECOVERED_ASSETS } from "../environment/kphxFullAirport/exactAssetCatalog.js";

const STRUCTURES_MANIFEST_URL = "/models/kphx-full-airport/batches/structures.manifest.json";
const T4_RESOURCES = Object.freeze([
  "Terminals/Terminal4.obj",
  "Terminals/Terminal4b.obj",
]);
const ALLOWED_VIEWS = new Set([
  "A", "B", "C", "D",
  "A1", "A14", "A30",
  "B2", "B14", "B28",
  "C1", "C9", "C19",
  "D1", "D4", "D7",
]);

function runtimeUrl(url) {
  if (!url || !url.startsWith("/")) return url;
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  if (!base || base === "/") return url;
  if (url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

function boundsForObjects(objects) {
  const box = new THREE.Box3();
  for (const object of objects) box.expandByObject(object);
  return box;
}

function selectedJetways(layer, view) {
  const exactGate = /\d/.test(view);
  return layer.children.filter((child) => {
    const gate = String(child.userData?.gate || "");
    return exactGate ? gate === view : gate.startsWith(view);
  });
}

function frameRampView(camera, terminalLayer, jetwayLayer, view) {
  const terminals = new THREE.Box3().setFromObject(terminalLayer);
  if (terminals.isEmpty()) throw new Error("Terminal 4 building layer produced empty bounds");

  const gates = selectedJetways(jetwayLayer, view);
  if (!gates.length) throw new Error(`No exact T4 jetways found for QA view ${view}`);

  const gateBounds = boundsForObjects(gates);
  if (gateBounds.isEmpty()) throw new Error(`T4 QA view ${view} produced empty jetway bounds`);

  const terminalCenter = terminals.getCenter(new THREE.Vector3());
  const gateCenter = gateBounds.getCenter(new THREE.Vector3());
  const gateSize = gateBounds.getSize(new THREE.Vector3());

  const exactGate = /\d/.test(view);
  let rampAnchor = gateCenter.clone();

  if (exactGate) {
    const candidates = [
      new THREE.Vector3(gateBounds.min.x, gateCenter.y, gateBounds.min.z),
      new THREE.Vector3(gateBounds.min.x, gateCenter.y, gateBounds.max.z),
      new THREE.Vector3(gateBounds.max.x, gateCenter.y, gateBounds.min.z),
      new THREE.Vector3(gateBounds.max.x, gateCenter.y, gateBounds.max.z),
    ];
    candidates.sort((a, b) => (
      b.distanceToSquared(terminalCenter) - a.distanceToSquared(terminalCenter)
    ));
    rampAnchor = candidates[0];
  }

  const outward = new THREE.Vector3(
    rampAnchor.x - terminalCenter.x,
    0,
    rampAnchor.z - terminalCenter.z,
  );
  if (outward.lengthSq() < 1e-6) throw new Error(`T4 QA view ${view} could not derive ramp-facing direction`);
  outward.normalize();

  const span = Math.max(gateSize.x, gateSize.z, exactGate ? 28 : 110);
  const closeGateQa = view === "A1" || view === "A14" || view === "A30" || view === "B2" || view === "B14";
  const tightGateFaceQa = view === "A14" || view === "A30" || view === "B2" || view === "B14";
  const bGateFarQa = view === "B2" || view === "B14";
  const distance = bGateFarQa
    ? Math.max(120, span * 2.0)
    : tightGateFaceQa
      ? Math.max(58, span * 1.05)
      : closeGateQa
        ? Math.max(90, span * 1.8)
        : exactGate
          ? Math.max(34, span * 0.72)
          : Math.max(125, span * 0.82);
  const height = bGateFarQa ? 7.0 : closeGateQa ? 6.0 : exactGate ? 5.0 : 9.5;

  const focus = tightGateFaceQa
    ? gateCenter.clone()
    : closeGateQa
      ? rampAnchor.clone().addScaledVector(outward, -15)
      : exactGate
        ? rampAnchor.clone().addScaledVector(outward, -38)
        : gateCenter.clone();
  focus.y = closeGateQa ? 4.5 : exactGate ? 4.5 : 5.0;
  const position = exactGate
    ? rampAnchor.clone().addScaledVector(outward, distance)
    : gateCenter.clone().addScaledVector(outward, distance);
  position.y = height;

  camera.position.copy(position);
  camera.lookAt(focus);
  camera.updateProjectionMatrix();

  return {
    view,
    selectedJetwayCount: gates.length,
    terminalCenter: terminalCenter.toArray(),
    gateCenter: gateCenter.toArray(),
    cameraPosition: position.toArray(),
    cameraTarget: focus.toArray(),
    derivedOutward: outward.toArray(),
    gateSpan: span,
  };
}

export default function KphxT4BuildingShellVerifier() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const requestedView = String(params?.get("view") || "A1").toUpperCase();
  const view = ALLOWED_VIEWS.has(requestedView) ? requestedView : "A1";
  const mountRef = useRef(null);
  const [status, setStatus] = useState("Loading exact T4 building shell…");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb8d0e4);
    scene.fog = new THREE.Fog(0xb8d0e4, 900, 3200);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "kphxT4BuildingShellVerifierCanvas";
    renderer.domElement.dataset.kphxT4BuildingShellVerifier = "loading";
    mount.appendChild(renderer.domElement);

    const environment = new THREE.Group();
    environment.name = "KPHX_T4_BUILDING_SHELL_QA";
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
      setStatus(`Loading exact T4 building shell · ${view} ramp view…`);

      const manifestResponse = await fetch(runtimeUrl(STRUCTURES_MANIFEST_URL), { cache: "no-cache" });
      if (!manifestResponse.ok) throw new Error(`T4 structures manifest HTTP ${manifestResponse.status}`);
      const manifest = await manifestResponse.json();
      if (manifest?.source?.version !== "1.75.1") {
        throw new Error(`T4 structures source version changed: ${manifest?.source?.version || "unknown"}`);
      }

      const packagePlacements = manifest.packageOwned?.placements || [];
      const placements = packagePlacements.filter((placement) => T4_RESOURCES.includes(placement.resource));
      if (placements.length !== 2) {
        throw new Error(`Expected 2 exact T4 building placements, found ${placements.length}`);
      }

      const placementByResource = new Map(placements.map((placement) => [placement.resource, placement]));
      for (const resource of T4_RESOURCES) {
        const placement = placementByResource.get(resource);
        const catalog = KPHX_EXACT_RECOVERED_ASSETS.singleResourceAssets[resource];
        if (!placement || !catalog) throw new Error(`Missing exact T4 source authority for ${resource}`);
        if (placement.assetUrl !== catalog.assetUrl) {
          throw new Error(`${resource} runtime asset changed: ${placement.assetUrl} !== ${catalog.assetUrl}`);
        }
        if (String(placement.id) !== String(catalog.wedObjectId)) {
          throw new Error(`${resource} WED placement changed: ${placement.id} !== ${catalog.wedObjectId}`);
        }
        if (placement.recoveredExact !== true) {
          throw new Error(`${resource} is no longer marked recoveredExact`);
        }
      }

      const loader = new GLTFLoader();
      const terminalLayer = new THREE.Group();
      terminalLayer.name = "KPHX_T4_EXACT_BUILDING_SHELL";
      environment.add(terminalLayer);

      const buildingOutcomes = await Promise.all(T4_RESOURCES.map(async (resource) => {
        const placement = placementByResource.get(resource);
        const gltf = await loader.loadAsync(runtimeUrl(placement.assetUrl));
        if (!gltf?.scene) throw new Error(`${resource} loaded without a scene root`);
        applyExactXp11Obj8MaskCompatibility(THREE, gltf.scene, {
          label: resource,
          alphaCutoff: 0.5,
          windingAlreadyConverted: false,
          correctLegacyTextureV: true,
        });
        const root = preparePlacementRoot(gltf.scene, placement);
        terminalLayer.add(root);
        return { resource, placement, root };
      }));

      if (buildingOutcomes.length !== 2 || terminalLayer.children.length !== 2) {
        throw new Error(`T4 building layer incomplete: ${terminalLayer.children.length}/2`);
      }

      const [surfaces, jetways] = await Promise.all([
        installKphxPackageOwnedSurfaceLayer(THREE, environment, { strict: true }),
        installKphxTerminal4StockJetways(THREE, environment, { strict: true }),
      ]);

      if (jetways.layer.userData.jetwayCount !== 76) {
        throw new Error(`T4 jetway lock changed: ${jetways.layer.userData.jetwayCount}/76`);
      }
      if (jetways.layer.userData.authoredOpenEdgeCount !== 261) {
        throw new Error(`T4 jetway authored edge lock changed: ${jetways.layer.userData.authoredOpenEdgeCount}/261`);
      }
      if (surfaces.layer.userData.polygonCount !== 13 || surfaces.layer.userData.lineMeshCount < 35) {
        throw new Error(
          `T4 exact surface context changed: polygons=${surfaces.layer.userData.polygonCount} lines=${surfaces.layer.userData.lineMeshCount}`,
        );
      }

      const framing = frameRampView(camera, terminalLayer, jetways.layer, view);
      renderer.render(scene, camera);

      const terminalBounds = new THREE.Box3().setFromObject(terminalLayer);
      const terminalSize = terminalBounds.getSize(new THREE.Vector3());

      renderer.domElement.dataset.kphxT4BuildingShellVerifier = "ready";
      renderer.domElement.dataset.kphxT4BuildingQaView = view;
      renderer.domElement.dataset.kphxT4BuildingPlacements = "2";
      renderer.domElement.dataset.kphxT4Terminal4WedObjectId = String(placementByResource.get("Terminals/Terminal4.obj").id);
      renderer.domElement.dataset.kphxT4Terminal4bWedObjectId = String(placementByResource.get("Terminals/Terminal4b.obj").id);
      renderer.domElement.dataset.kphxT4Terminal4Asset = placementByResource.get("Terminals/Terminal4.obj").assetUrl;
      renderer.domElement.dataset.kphxT4Terminal4bAsset = placementByResource.get("Terminals/Terminal4b.obj").assetUrl;
      renderer.domElement.dataset.kphxT4JetwayCount = String(jetways.layer.userData.jetwayCount);
      renderer.domElement.dataset.kphxT4JetwayOpenEdges = String(jetways.layer.userData.authoredOpenEdgeCount);
      renderer.domElement.dataset.kphxT4SelectedJetwayCount = String(framing.selectedJetwayCount);
      renderer.domElement.dataset.kphxT4CameraPosition = framing.cameraPosition.join(",");
      renderer.domElement.dataset.kphxT4CameraTarget = framing.cameraTarget.join(",");
      renderer.domElement.dataset.kphxT4TerminalBoundsSize = terminalSize.toArray().join(",");
      renderer.domElement.dataset.kphxT4SurfacePolygons = String(surfaces.layer.userData.polygonCount);
      renderer.domElement.dataset.kphxT4SurfaceLines = String(surfaces.layer.userData.lineMeshCount);
      renderer.domElement.dataset.kphxT4LegacyMaskCompatibility = "true";
      renderer.domElement.dataset.kphxT4SubstitutionPolicy = "none";
      renderer.domElement.dataset.kphxT4LoadMs = String(Math.round(performance.now() - startedAt));

      setStatus(
        `Exact T4 building shell ready · ${view} · 2 source buildings · 76 locked jetways · no substitutions`,
      );
    };

    load().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      renderer.domElement.dataset.kphxT4BuildingShellVerifier = "error";
      renderer.domElement.dataset.kphxT4BuildingShellVerifierError = message;
      setStatus(`T4 building-shell verifier failed: ${message}`);
      console.error("KPHX T4 building-shell verifier failed", error);
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
  }, [view]);

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
