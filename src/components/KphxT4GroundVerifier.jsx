import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  kphxWedToRampReadyPosition,
  kphxXPlaneHeadingToRampReadyYawRadians,
} from "../environment/kphxFullAirport/sourceAuthority.js";
import {
  SOURCE_KPHX_A1_ORIGIN,
  SOURCE_KPHX_TERMINAL4_OBJECTS,
} from "../environment/sourceKphxTerminal4.js";
import { installKphxPackageOwnedSurfaceLayer } from "../environment/kphxFullAirport/installPackageOwnedSurfaceLayer.js";

const EARTH_RADIUS_METERS = 6378137;

function verifiedFramePosition(latitude, longitude) {
  const latitude0 = SOURCE_KPHX_A1_ORIGIN.latitude * Math.PI / 180;
  const east = (longitude - SOURCE_KPHX_A1_ORIGIN.longitude) * Math.PI / 180
    * EARTH_RADIUS_METERS * Math.cos(latitude0);
  const north = (latitude - SOURCE_KPHX_A1_ORIGIN.latitude) * Math.PI / 180
    * EARTH_RADIUS_METERS;
  return [
    -north + SOURCE_KPHX_A1_ORIGIN.browserPosition[0],
    SOURCE_KPHX_A1_ORIGIN.browserPosition[1],
    -east + SOURCE_KPHX_A1_ORIGIN.browserPosition[2],
  ];
}

function runtimeUrl(url) {
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  return base && base !== "/" ? `${base}${url}` : url;
}

export default function KphxT4GroundVerifier() {
  const mountRef = useRef(null);
  const [status, setStatus] = useState("Loading exact T4/A1 ground context…");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb6d0e3);
    scene.fog = new THREE.Fog(0xb6d0e3, 700, 2600);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 4500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "kphxT4GroundVerifierCanvas";
    renderer.domElement.dataset.kphxT4GroundVerifier = "loading";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b655e, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 3.0);
    sun.position.set(420, 650, 260);
    scene.add(sun);

    const root = new THREE.Group();
    root.name = "KPHX_T4_A1_GROUND_VERIFIER";
    scene.add(root);

    const a1 = new THREE.Group();
    a1.name = "T4_GATE_A1_AUTHORITY";
    a1.position.fromArray(SOURCE_KPHX_A1_ORIGIN.browserPosition);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 12, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd100 }),
    );
    mast.position.y = 6;
    a1.add(mast);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.55, 10, 40),
      new THREE.MeshStandardMaterial({ color: 0xffd100 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    a1.add(ring);
    root.add(a1);

    let disposed = false;
    let raf = 0;
    const resize = () => {
      if (disposed) return;
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);
    resize();

    const animate = () => {
      if (disposed) return;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const load = async () => {
      const loader = new GLTFLoader();
      const checks = [];

      for (const object of SOURCE_KPHX_TERMINAL4_OBJECTS) {
        const currentPosition = kphxWedToRampReadyPosition(object.latitude, object.longitude, 0);
        const verifiedPosition = verifiedFramePosition(object.latitude, object.longitude);
        const positionDelta = Math.hypot(
          currentPosition[0] - verifiedPosition[0],
          currentPosition[2] - verifiedPosition[2],
        );
        const yaw = kphxXPlaneHeadingToRampReadyYawRadians(object.headingDegrees);
        const verifiedYaw = THREE.MathUtils.degToRad(90 - object.headingDegrees);
        const yawDelta = Math.abs(yaw - verifiedYaw);
        if (positionDelta > 0.001 || yawDelta > 1e-9) {
          throw new Error(`${object.resource} no longer matches verified KPHX source frame`);
        }
        checks.push({ resource: object.resource, positionDelta, yawDelta });

        const gltf = await loader.loadAsync(runtimeUrl(`/models/kphx/${object.runtime}`));
        const model = gltf.scene;
        model.name = object.name;
        model.position.fromArray(currentPosition);
        model.rotation.y = yaw;
        model.traverse((node) => {
          if (!node.isMesh) return;
          node.castShadow = true;
          node.receiveShadow = true;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) {
            if (material?.map) material.map.colorSpace = THREE.SRGBColorSpace;
          }
        });
        root.add(model);
      }

      const packageSurfaces = await installKphxPackageOwnedSurfaceLayer(THREE, root, {
        manifestUrl: "/models/kphx-full-airport/surfaces/manifest.json",
        networkUrl: "/models/kphx-full-airport/surfaces/surface-network.json",
        strict: true,
      });

      const zdpSurfaces = await installKphxPackageOwnedSurfaceLayer(THREE, root, {
        manifestUrl: "/models/kphx-full-airport/t4-a1-zdp-surfaces/manifest.json",
        networkUrl: "/models/kphx-full-airport/t4-a1-zdp-surfaces/surface-network.json",
        strict: true,
      });

      const zdpNetwork = zdpSurfaces.network;
      const zdpPlacements =
        (zdpNetwork.polygons || []).length
        + (zdpNetwork.drapedOrthophotos || []).length
        + (zdpNetwork.lines || []).length;

      if (zdpNetwork.scope?.radiusMeters !== 250) {
        throw new Error(`Expected exact 250m A1 surface slice, got ${zdpNetwork.scope?.radiusMeters}`);
      }
      if (!zdpPlacements) throw new Error("250m A1 ZDP surface slice is empty");
      if (zdpSurfaces.manifest.resolvedExternalResourceCount !== 14) {
        throw new Error(`Expected 14 exact local ZDP art resources, got ${zdpSurfaces.manifest.resolvedExternalResourceCount}`);
      }

      const center = new THREE.Vector3(...SOURCE_KPHX_A1_ORIGIN.browserPosition);
      camera.position.set(center.x + 330, 210, center.z + 360);
      camera.lookAt(center.x - 20, 8, center.z - 20);
      camera.updateProjectionMatrix();

      const packageLayer = packageSurfaces.layer.userData;
      const zdpLayer = zdpSurfaces.layer.userData;
      renderer.domElement.dataset.kphxT4GroundVerifier = "ready";
      renderer.domElement.dataset.kphxT4ObjectCount = "2";
      renderer.domElement.dataset.kphxA1RadiusMeters = String(zdpNetwork.scope.radiusMeters);
      renderer.domElement.dataset.kphxZdpPlacements = String(zdpPlacements);
      renderer.domElement.dataset.kphxZdpResources = String(zdpSurfaces.manifest.resolvedExternalResourceCount);
      renderer.domElement.dataset.kphxZdpPolygons = String(zdpLayer.polygonCount);
      renderer.domElement.dataset.kphxZdpDraped = String(zdpLayer.drapedOrthophotoCount);
      renderer.domElement.dataset.kphxZdpLineMeshes = String(zdpLayer.lineMeshCount);
      renderer.domElement.dataset.kphxPackagePolygons = String(packageLayer.polygonCount);
      renderer.domElement.dataset.kphxPackageLineMeshes = String(packageLayer.lineMeshCount);
      renderer.domElement.dataset.kphxMaxPositionDeltaMeters = String(Math.max(...checks.map((x) => x.positionDelta)));
      renderer.domElement.dataset.kphxMaxYawDeltaRadians = String(Math.max(...checks.map((x) => x.yawDelta)));
      setStatus(`T4/A1 exact ground · 250m · ${zdpPlacements} ZDP placements · 14 resources`);
    };

    load().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      renderer.domElement.dataset.kphxT4GroundVerifier = "error";
      renderer.domElement.dataset.kphxT4GroundError = message;
      setStatus(`T4/A1 ground failed: ${message}`);
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
        borderRadius: 8, background: "rgba(0,0,0,.72)", color: "white",
        font: "600 13px/1.35 system-ui, sans-serif", pointerEvents: "none",
      }}>{status}</div>
    </main>
  );
}
