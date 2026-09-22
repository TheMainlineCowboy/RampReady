import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  SOURCE_KPHX_A1_ORIGIN,
  SOURCE_KPHX_TERMINAL4_OBJECTS,
} from "../environment/sourceKphxTerminal4.js";
import {
  loadExactPrototype,
  measurePrototypeReach,
  applyIndividualArticulation,
  loadPlacementMap,
} from "../environment/sourceKphxWedJetwayFleet.js";
import { computeUploadedJetwayArticulation } from "../environment/uploadedAirportJetwayArticulationV10.js";
import {
  kphxWedToRampReadyPosition,
  kphxXPlaneHeadingToRampReadyYawRadians,
} from "../environment/kphxFullAirport/sourceAuthority.js";

const A1_FACADE_OBJECT_ID = 104804;
const EXACT_GLB_SHA256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0";

function runtimeUrl(url) {
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  return base && base !== "/" ? `${base}${url}` : url;
}

export default function KphxA1JetwayVerifier() {
  const mountRef = useRef(null);
  const [status, setStatus] = useState("Loading exact A1 jet bridge…");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb7d0e2);
    scene.fog = new THREE.Fog(0xb7d0e2, 500, 1700);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "kphxA1JetwayVerifierCanvas";
    renderer.domElement.dataset.kphxA1JetwayVerifier = "loading";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x69645d, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.position.set(220, 420, 180);
    scene.add(sun);

    const root = new THREE.Group();
    root.name = "KPHX_A1_EXACT_JETWAY_VERIFIER";
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

    const render = () => {
      if (disposed) return;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    const load = async () => {
      const loader = new GLTFLoader();

      const object = SOURCE_KPHX_TERMINAL4_OBJECTS.find((entry) => entry.resource === "Terminals/Terminal4b.obj");
      if (!object) throw new Error("Exact Terminal4b source object is missing");
      const terminalGltf = await loader.loadAsync(runtimeUrl(`/models/kphx/${object.runtime}`));
      const terminal = terminalGltf.scene;
      terminal.name = object.name;
      terminal.position.fromArray(kphxWedToRampReadyPosition(object.latitude, object.longitude, 0));
      terminal.rotation.y = kphxXPlaneHeadingToRampReadyYawRadians(object.headingDegrees);
      terminal.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (material?.map) material.map.colorSpace = THREE.SRGBColorSpace;
        }
      });
      root.add(terminal);


      const [map, rawFacadeResponse, prototype] = await Promise.all([
        loadPlacementMap(),
        fetch(runtimeUrl("/models/kphx/wed-jetways.exact.json"), { cache: "no-store" }),
        loadExactPrototype(THREE),
      ]);
      if (!rawFacadeResponse.ok) throw new Error(`Raw WED jetway manifest HTTP ${rawFacadeResponse.status}`);
      const rawFacades = await rawFacadeResponse.json();

      const a1 = map.placements.find((placement) => placement.gate === "A1");
      const rawA1 = rawFacades.placements.find((placement) => placement.wedObjectId === A1_FACADE_OBJECT_ID);
      if (!a1 || !rawA1) throw new Error("Exact A1 WED jetway authority is missing");
      if (a1.rampWedObjectId !== 27855) throw new Error(`A1 ramp authority changed to ${a1.rampWedObjectId}`);
      if (a1.facadeWedObjectId !== A1_FACADE_OBJECT_ID) throw new Error(`A1 facade authority changed to ${a1.facadeWedObjectId}`);
      if (a1.facadeNodeCount !== 7 || rawA1.rings?.[0]?.nodes?.length !== 7) {
        throw new Error("A1 exact WED facade must preserve seven nodes");
      }
      if (Math.abs(a1.x - a1.sourceAxis.rotunda[0]) > 1e-9 || Math.abs(a1.z - a1.sourceAxis.rotunda[1]) > 1e-9) {
        throw new Error("A1 rotunda anchor no longer equals the WED source-axis rotunda");
      }

      const reach = measurePrototypeReach(THREE, prototype);
      const articulation = computeUploadedJetwayArticulation(a1, reach.sourceContactDistance);
      const a1Model = prototype.clone(true);
      a1Model.name = "KPHX_A1_EXACT_AIRPORT_JETWAY";
      applyIndividualArticulation(a1Model, articulation);
      const attachedReach = measurePrototypeReach(THREE, a1Model);
      const actualDoorGap = Math.abs(a1.aircraftDoorDistance - attachedReach.sourceContactDistance);
      if (!attachedReach.partOrderValid) throw new Error("A1 jetway source-part order changed");
      if (actualDoorGap > 0.05) throw new Error(`A1 exact jetway door-gap error is ${actualDoorGap.toFixed(4)}m`);

      const sourceFrame = new THREE.Group();
      sourceFrame.name = "KPHX_A1_JETWAY_SOURCE_FRAME";
      sourceFrame.position.fromArray(SOURCE_KPHX_A1_ORIGIN.browserPosition);
      sourceFrame.rotation.y = THREE.MathUtils.degToRad(90);

      const anchor = new THREE.Group();
      anchor.name = "KPHX_A1_WED_JETWAY_ANCHOR";
      anchor.position.set(a1.x, 0, a1.z);
      anchor.rotation.y = a1.yawRadians;
      anchor.add(a1Model);
      sourceFrame.add(anchor);
      root.add(sourceFrame);

      const footprintPoints = rawA1.rings[0].nodes.map((node) => {
        const world = kphxWedToRampReadyPosition(Number(node.latitude), Number(node.longitude), 0.08);
        return new THREE.Vector3(...world);
      });
      footprintPoints.push(footprintPoints[0].clone());
      const footprintGeometry = new THREE.BufferGeometry().setFromPoints(footprintPoints);
      const footprint = new THREE.Line(
        footprintGeometry,
        new THREE.LineBasicMaterial({ color: 0x00ffff }),
      );
      footprint.name = "KPHX_A1_WED_7_NODE_FOOTPRINT";
      root.add(footprint);

      const a1Marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xffd100 }),
      );
      a1Marker.position.fromArray(SOURCE_KPHX_A1_ORIGIN.browserPosition);
      a1Marker.position.y = 4;
      root.add(a1Marker);

      sourceFrame.updateMatrixWorld(true);
      anchor.updateMatrixWorld(true);
      const worldAnchor = new THREE.Vector3();
      anchor.getWorldPosition(worldAnchor);

      const expectedWorldAnchor = new THREE.Vector3(
        a1.z,
        0,
        -a1.x + SOURCE_KPHX_A1_ORIGIN.browserPosition[2],
      );
      const anchorError = worldAnchor.distanceTo(expectedWorldAnchor);
      if (anchorError > 0.001) throw new Error(`A1 WED anchor transform error ${anchorError.toFixed(6)}m`);

      camera.position.set(worldAnchor.x + 55, 28, worldAnchor.z + 58);
      camera.lookAt(worldAnchor.x + 3, 4.5, worldAnchor.z + 4);
      camera.updateProjectionMatrix();

      renderer.domElement.dataset.kphxA1JetwayVerifier = "ready";
      renderer.domElement.dataset.kphxA1RampWedObjectId = String(a1.rampWedObjectId);
      renderer.domElement.dataset.kphxA1FacadeWedObjectId = String(a1.facadeWedObjectId);
      renderer.domElement.dataset.kphxA1FacadeNodeCount = String(a1.facadeNodeCount);
      renderer.domElement.dataset.kphxA1JetwayGlbSha256 = EXACT_GLB_SHA256;
      renderer.domElement.dataset.kphxA1BridgeEndMeters = String(a1.bridgeEnd);
      renderer.domElement.dataset.kphxA1SourceContactMeters = String(reach.sourceContactDistance);
      renderer.domElement.dataset.kphxA1ActualContactMeters = String(attachedReach.sourceContactDistance);
      renderer.domElement.dataset.kphxA1ActualDoorGapMeters = String(actualDoorGap);
      renderer.domElement.dataset.kphxA1AnchorErrorMeters = String(anchorError);
      renderer.domElement.dataset.kphxA1YawRadians = String(a1.yawRadians);
      renderer.domElement.dataset.kphxA1PartOrderValid = String(attachedReach.partOrderValid);
      setStatus(`A1 exact jet bridge · WED 104804 · 7 nodes · door gap ${actualDoorGap.toFixed(3)}m`);
    };

    load().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      renderer.domElement.dataset.kphxA1JetwayVerifier = "error";
      renderer.domElement.dataset.kphxA1JetwayError = message;
      setStatus(`A1 jetway failed: ${message}`);
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
        borderRadius: 8, background: "rgba(0,0,0,.75)", color: "white",
        font: "600 13px/1.35 system-ui, sans-serif", pointerEvents: "none",
      }}>{status}</div>
    </main>
  );
}
