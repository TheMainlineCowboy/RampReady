import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SOURCE_KPHX_TERMINAL4_OBJECTS } from "../environment/sourceKphxTerminal4.js";
import {
  kphxWedToRampReadyPosition,
  kphxXPlaneHeadingToRampReadyYawRadians,
} from "../environment/kphxFullAirport/sourceAuthority.js";
import { buildXp11Type2Facade } from "../environment/kphxFullAirport/xp11Type2Facade.js";

const A1_FACADE_ID = 104804;
const A1_RESOURCE = "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";
const STOCK_BASE = "/models/xplane11-stock/jetway1";

function runtimeUrl(url) {
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  const clean = String(url).startsWith("/") ? url : `/${url}`;
  return base && base !== "/" ? `${base}${clean}` : clean;
}

export default function KphxA1JetwayVerifier() {
  const mountRef = useRef(null);
  const [status, setStatus] = useState("Loading exact XP11 A1 jetway facade…");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb8d0df);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "kphxA1JetwayVerifierCanvas";
    renderer.domElement.dataset.kphxA1JetwayVerifier = "loading";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6e6962, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 3.0);
    sun.position.set(100, 240, 130);
    sun.castShadow = true;
    scene.add(sun);

    const root = new THREE.Group();
    root.name = "KPHX_A1_XP11_STOCK_JETWAY_VERIFIER";
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

      const [facadeResponse, wedResponse] = await Promise.all([
        fetch(runtimeUrl(`${STOCK_BASE}/jetway_1_solid.fac`), { cache: "no-store" }),
        fetch(runtimeUrl("/models/kphx/wed-jetways.exact.json"), { cache: "no-store" }),
      ]);
      if (!facadeResponse.ok) throw new Error(`XP11 stock facade HTTP ${facadeResponse.status}`);
      if (!wedResponse.ok) throw new Error(`KPHX WED jetways HTTP ${wedResponse.status}`);
      const facadeText = await facadeResponse.text();
      const wed = await wedResponse.json();
      const a1 = wed.placements.find((p) => p.wedObjectId === A1_FACADE_ID);
      if (!a1) throw new Error("WED facade 104804 is missing");
      if (a1.resource !== A1_RESOURCE) throw new Error(`A1 resource changed: ${a1.resource}`);
      const nodes = a1.rings?.[0]?.nodes || [];
      if (nodes.length !== 7) throw new Error(`A1 must preserve seven WED nodes, got ${nodes.length}`);

      const footprint = nodes.map((node) => {
        const world = kphxWedToRampReadyPosition(Number(node.latitude), Number(node.longitude), 0);
        return new THREE.Vector2(world[0], world[2]);
      });
      const wallChoices = nodes.map((node) => {
        const match = String(node.wallType || node.wall_type || "").match(/Wall\s+(\d+)/i);
        if (!match) throw new Error(`A1 node ${node.wedObjectId} lost wall choice`);
        return Number(match[1]) - 1; // WED XML labels are one-based; facade/DSF choices are zero-based.
      });

      const built = await buildXp11Type2Facade({
        facadeText,
        footprint,
        wallChoices,
        basePath: STOCK_BASE,
      });
      built.root.name = "KPHX_A1_Exact_XP11_Stock_Jetway_1_solid";
      root.add(built.root);

      const outlinePoints = footprint.map((p) => new THREE.Vector3(p.x, 0.08, p.y));
      outlinePoints.push(outlinePoints[0].clone());
      root.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(outlinePoints),
        new THREE.LineBasicMaterial({ color: 0x00ffff }),
      ));

      const center = footprint.reduce((sum, p) => sum.add(p), new THREE.Vector2()).multiplyScalar(1 / footprint.length);
      camera.position.set(center.x + 48, 24, center.y + 48);
      camera.lookAt(center.x, 4.2, center.y);
      camera.updateProjectionMatrix();

      renderer.domElement.dataset.kphxA1JetwayVerifier = "ready";
      renderer.domElement.dataset.kphxA1FacadeWedObjectId = String(A1_FACADE_ID);
      renderer.domElement.dataset.kphxA1FacadeResource = A1_RESOURCE;
      renderer.domElement.dataset.kphxA1FacadeNodeCount = String(nodes.length);
      renderer.domElement.dataset.kphxA1WallChoices = wallChoices.map((v) => v + 1).join(",");
      renderer.domElement.dataset.kphxA1SourceMode = "XP11-stock-type2-facade";
      renderer.domElement.dataset.kphxA1OldAirportJetwayGlbLoaded = "false";
      renderer.domElement.dataset.kphxA1WallEvidence = JSON.stringify(built.wallEvidence);
      setStatus("A1 · exact XP11 Jetway_1_solid.fac · 7 WED nodes · no substitute GLB");
    };

    load().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      renderer.domElement.dataset.kphxA1JetwayVerifier = "error";
      renderer.domElement.dataset.kphxA1JetwayError = message;
      setStatus(`A1 failed: ${message}`);
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
