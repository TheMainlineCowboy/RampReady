import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SOURCE_KPHX_TERMINAL4_OBJECTS } from "../environment/sourceKphxTerminal4.js";
import { kphxWedToRampReadyPosition, kphxXPlaneHeadingToRampReadyYawRadians } from "../environment/kphxFullAirport/sourceAuthority.js";
import { buildXp11Type2Facade } from "../environment/kphxFullAirport/xp11Type2Facade.js";

const GATES = Object.freeze(["A1","A2","A3","A4","A5","A6","A7","A8"]);
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
  const [status, setStatus] = useState("Loading exact XP11 T4 jetways A1–A8…");

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
    root.name = "KPHX_T4_A1_A8_XP11_STOCK_JETWAY_VERIFIER";
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
      const loader = new GLTFLoader();

      for (const object of SOURCE_KPHX_TERMINAL4_OBJECTS) {
        const gltf = await loader.loadAsync(runtimeUrl(`/models/kphx/${object.runtime}`));
        const model = gltf.scene;
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

      const evidence = [];
      const allPoints = [];
      let totalEdges = 0;

      for (const gate of GATES) {
        const gateMap = map.placements.find((entry) => entry.gate === gate);
        if (!gateMap) throw new Error(`Missing T4 gate mapping for ${gate}`);

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
      renderer.domElement.dataset.kphxT4JetwayBatchGates = GATES.join(",");
      renderer.domElement.dataset.kphxT4JetwayBatchCount = String(evidence.length);
      renderer.domElement.dataset.kphxT4JetwayBatchTotalEdges = String(totalEdges);
      renderer.domElement.dataset.kphxT4JetwayBatchResource = RESOURCE;
      renderer.domElement.dataset.kphxT4JetwayBatchOldAirportJetwayGlbLoaded = "false";
      renderer.domElement.dataset.kphxT4JetwayBatchEvidence = JSON.stringify(evidence);
      setStatus(`T4 exact XP11 stock jetways · ${GATES.join("–")} · ${totalEdges} authored open edges · no substitute GLB`);
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
