import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SOURCE_KPHX_TERMINAL4_OBJECTS } from "../environment/sourceKphxTerminal4.js";
import { kphxWedToRampReadyPosition, kphxXPlaneHeadingToRampReadyYawRadians } from "../environment/kphxFullAirport/sourceAuthority.js";
import { buildXp11Type2Facade } from "../environment/kphxFullAirport/xp11Type2Facade.js";
import { applyExactXp11Obj8MaskCompatibility } from "../environment/kphxFullAirport/obj8RenderCompatibility.js";

const BATCHES = Object.freeze({
  "A1-A8": Object.freeze(["A1","A2","A3","A4","A5","A6","A7","A8"]),
  "A9-A14": Object.freeze(["A9","A10","A11","A12","A13","A14"]),
  "A17-A24": Object.freeze(["A17","A18","A19","A20","A21","A22","A23","A24"]),
  "A25-A30": Object.freeze(["A25","A26","A27","A29","A30"]),
  "B2-B10": Object.freeze(["B2","B3","B4","B5","B6","B7","B8","B9","B10"]),
  "B11-B20": Object.freeze(["B11","B12","B13","B14","B16","B17","B18","B19","B20"]),
  "B21A-B28": Object.freeze(["B21A","B22","B23A","B24","B25","B27","B28"]),
  "C1-C9": Object.freeze(["C1","C2","C3","C4","C6","C7","C8","C9"]),
  "C11-C19": Object.freeze(["C11","C12","C13","C14","C16","C17","C18","C19"]),
  "D1-D7": Object.freeze([
    "D1","D2","D3","D4","D5","D6",
    Object.freeze({ gate: "D7", facadeWedObjectId: 106842 }),
    Object.freeze({ gate: "D7", facadeWedObjectId: 106853 }),
  ]),
  "ALL": null,
});

function resolveBatch() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const requested = params?.get("batch") || "A1-A8";
  if (!(requested in BATCHES) && !(requested in OVERVIEW_FILTERS)) {
    throw new Error(`Unknown T4 jetway batch: ${requested}`);
  }
  return {
    name: requested,
    gates: requested in BATCHES ? BATCHES[requested] : null,
    overviewFilter: OVERVIEW_FILTERS[requested] || null,
  };
}
const OVERVIEW_FILTERS = Object.freeze({
  "A-ALL": (entry) => String(entry.gate).startsWith("A"),
  "B-ALL": (entry) => String(entry.gate).startsWith("B"),
  "CD-ALL": (entry) => String(entry.gate).startsWith("C") || String(entry.gate).startsWith("D"),
});
const RESOURCE = "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";
const STOCK_BASE = "/models/xplane11-stock/jetway1";

function runtimeUrl(url) {
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  const clean = String(url).startsWith("/") ? url : `/${url}`;
  return base && base !== "/" ? `${base}${clean}` : clean;
}

function wallChoice(node) {
  const match = String(node.wallType || node.wall_type || "").match(/Wall\s+(\d+)/i);
  if (!match) throw new Error(`WED node ${node.wedObjectId} lost wall choice`);
  return Number(match[1]) - 1;
}

export default function KphxT4JetwayBatchVerifier() {
  const mountRef = useRef(null);
  const [status, setStatus] = useState("Loading exact XP11 T4 jetway batch…");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb8d0df);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "kphxT4JetwayBatchVerifierCanvas";
    renderer.domElement.dataset.kphxT4JetwayBatchVerifier = "loading";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6e6962, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 3.0);
    sun.position.set(180, 320, 220);
    sun.castShadow = true;
    scene.add(sun);

    const root = new THREE.Group();
    root.name = "KPHX_T4_XP11_STOCK_JETWAY_BATCH_VERIFIER";
    scene.add(root);

    let disposed = false;
    let raf = 0;
    const resize = () => {
      if (disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);
    resize();

    const loop = () => {
      if (disposed) return;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const load = async () => {
      const { name: batchName, gates, overviewFilter } = resolveBatch();
      const loader = new GLTFLoader();

      for (const object of SOURCE_KPHX_TERMINAL4_OBJECTS) {
        const gltf = await loader.loadAsync(runtimeUrl(`/models/kphx/${object.runtime}`));
        const model = gltf.scene;
        applyExactXp11Obj8MaskCompatibility(THREE, model, {
          label: object.resource,
          alphaCutoff: 0.5,
          windingAlreadyConverted: false,
          correctLegacyTextureV: true,
        });
        model.name = object.name;
        model.position.fromArray(kphxWedToRampReadyPosition(object.latitude, object.longitude, 0));
        model.rotation.y = kphxXPlaneHeadingToRampReadyYawRadians(object.headingDegrees);
        model.traverse((node) => {
          if (!node.isMesh) return;
          node.receiveShadow = true;
          node.castShadow = false;
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if (material?.map) material.map.colorSpace = THREE.SRGBColorSpace;
          }
        });
        root.add(model);
      }

      const [facadeResponse, wedResponse, mapResponse] = await Promise.all([
        fetch(runtimeUrl(`${STOCK_BASE}/jetway_1_solid.fac`), { cache: "no-store" }),
        fetch(runtimeUrl("/models/kphx/wed-jetways.exact.json"), { cache: "no-store" }),
        fetch(runtimeUrl("/models/kphx/terminal4-wed-jetways.exact.json"), { cache: "no-store" }),
      ]);
      if (!facadeResponse.ok) throw new Error(`XP11 stock facade HTTP ${facadeResponse.status}`);
      if (!wedResponse.ok) throw new Error(`KPHX WED jetways HTTP ${wedResponse.status}`);
      if (!mapResponse.ok) throw new Error(`T4 gate map HTTP ${mapResponse.status}`);

      const facadeText = await facadeResponse.text();
      const wed = await wedResponse.json();
      const map = await mapResponse.json();
      const sourcePlacements = overviewFilter
        ? map.placements.filter(overviewFilter)
        : map.placements;
      const resolvedGates = gates ?? sourcePlacements.map((entry) => ({
        gate: entry.gate,
        facadeWedObjectId: entry.facadeWedObjectId,
      }));
      const batchLabels = resolvedGates.map((entry) => typeof entry === "string" ? entry : entry.gate);

      const evidence = [];
      const allPoints = [];
      let totalEdges = 0;

      for (const gateSelector of resolvedGates) {
        const selector = typeof gateSelector === "string"
          ? { gate: gateSelector, facadeWedObjectId: null }
          : gateSelector;
        const gate = selector.gate;
        const gateMap = map.placements.find((entry) => (
          entry.gate === gate
          && (selector.facadeWedObjectId == null || entry.facadeWedObjectId === selector.facadeWedObjectId)
        ));
        if (!gateMap) {
          throw new Error(`Missing T4 gate mapping for ${gate}${selector.facadeWedObjectId ? ` facade ${selector.facadeWedObjectId}` : ""}`);
        }

        const placement = wed.placements.find((entry) => entry.wedObjectId === gateMap.facadeWedObjectId);
        if (!placement) throw new Error(`Missing WED facade ${gateMap.facadeWedObjectId} for ${gate}`);
        if (placement.resource !== RESOURCE) throw new Error(`${gate} resource changed: ${placement.resource}`);

        const nodes = placement.rings?.[0]?.nodes || [];
        if (nodes.length !== gateMap.facadeNodeCount) {
          throw new Error(`${gate} node count mismatch map=${gateMap.facadeNodeCount} WED=${nodes.length}`);
        }

        const footprint = nodes.map((node) => {
          const world = kphxWedToRampReadyPosition(Number(node.latitude), Number(node.longitude), 0);
          const point = new THREE.Vector2(world[0], world[2]);
          allPoints.push(point.clone());
          return point;
        });
        const wallChoices = nodes.map(wallChoice);

        const built = await buildXp11Type2Facade({
          facadeText,
          footprint,
          wallChoices,
          basePath: STOCK_BASE,
        });
        built.root.name = `KPHX_${gate}_Exact_XP11_Stock_Jetway`;
        root.add(built.root);

        const outlinePoints = footprint.map((p) => new THREE.Vector3(p.x, 0.08, p.y));
        if (built.facade.ringMode !== 0) outlinePoints.push(outlinePoints[0].clone());
        const outline = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(outlinePoints),
          new THREE.LineBasicMaterial({ color: 0x00ffff }),
        );
        outline.name = `${gate}_WED_Facade_Path`;
        root.add(outline);

        totalEdges += built.wallEvidence.length;
        evidence.push({
          gate,
          rampWedObjectId: gateMap.rampWedObjectId,
          facadeWedObjectId: gateMap.facadeWedObjectId,
          nodeCount: nodes.length,
          wallChoices: wallChoices.map((value) => value + 1),
          ringMode: built.facade.ringMode,
          renderedEdgeCount: built.wallEvidence.length,
          walls: built.wallEvidence.map((wall) => ({
            wallNumber: wall.wallNumber,
            wallChoiceSource: wall.wallChoiceSource,
            wallName: wall.wallName,
            wallLength: wall.wallLength,
            spelling: wall.spelling,
            stretch: wall.stretch,
          })),
        });
      }

      const minX = Math.min(...allPoints.map((point) => point.x));
      const maxX = Math.max(...allPoints.map((point) => point.x));
      const minZ = Math.min(...allPoints.map((point) => point.y));
      const maxZ = Math.max(...allPoints.map((point) => point.y));
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX, maxZ - minZ);
      const distance = Math.max(100, span * 1.15);

      camera.position.set(centerX + distance * 0.72, distance * 0.55, centerZ + distance * 0.78);
      camera.lookAt(centerX, 4.5, centerZ);
      camera.updateProjectionMatrix();

      renderer.domElement.dataset.kphxT4JetwayBatchVerifier = "ready";
      renderer.domElement.dataset.kphxT4JetwayBatchName = batchName;
      renderer.domElement.dataset.kphxT4JetwayBatchGates = batchLabels.join(",");
      renderer.domElement.dataset.kphxT4JetwayBatchCount = String(evidence.length);
      renderer.domElement.dataset.kphxT4JetwayBatchTotalEdges = String(totalEdges);
      renderer.domElement.dataset.kphxT4JetwayBatchResource = RESOURCE;
      renderer.domElement.dataset.kphxT4JetwayBatchOldAirportJetwayGlbLoaded = "false";
      renderer.domElement.dataset.kphxT4JetwayBatchEvidence = JSON.stringify(evidence);
      setStatus(`T4 exact XP11 stock jetways · ${batchLabels.join("–")} · ${totalEdges} authored open edges · no substitute GLB`);
    };

    load().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      renderer.domElement.dataset.kphxT4JetwayBatchVerifier = "error";
      renderer.domElement.dataset.kphxT4JetwayBatchError = message;
      setStatus(`T4 jetway batch failed: ${message}`);
      console.error(error);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#111", overflow: "hidden" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div style={{
        position: "absolute", left: 16, top: 16, padding: "10px 12px",
        borderRadius: 8, background: "rgba(0,0,0,.76)", color: "white",
        font: "600 13px/1.35 system-ui, sans-serif", pointerEvents: "none",
      }}>{status}</div>
    </main>
  );
}
