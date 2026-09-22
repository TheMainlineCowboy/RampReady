import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { installKphxPackageOwnedSurfaceLayer } from "../environment/kphxFullAirport/installPackageOwnedSurfaceLayer.js";
import {
  KPHX_FULL_AIRPORT_SOURCE,
  kphxWedToRampReadyPosition,
  kphxXPlaneHeadingToRampReadyYawRadians,
} from "../environment/kphxFullAirport/sourceAuthority.js";
import {
  SOURCE_KPHX_A1_ORIGIN,
  SOURCE_KPHX_TERMINAL4_OBJECTS,
} from "../environment/sourceKphxTerminal4.js";

const EARTH_RADIUS_METERS = 6378137;

function sourceLocalFromVerifiedFrame(latitude, longitude) {
  const latitude0 = SOURCE_KPHX_A1_ORIGIN.latitude * Math.PI / 180;
  const east = (longitude - SOURCE_KPHX_A1_ORIGIN.longitude) * Math.PI / 180
    * EARTH_RADIUS_METERS * Math.cos(latitude0);
  const north = (latitude - SOURCE_KPHX_A1_ORIGIN.latitude) * Math.PI / 180
    * EARTH_RADIUS_METERS;
  // This is the old verified source-local frame, after its one +90° parent rotation.
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

export default function KphxT4FrameVerifier() {
  const mountRef = useRef(null);
  const [status, setStatus] = useState("Checking exact T4 source frame…");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb8d2e7);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 4000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "kphxT4FrameVerifierCanvas";
    renderer.domElement.dataset.kphxT4FrameVerifier = "loading";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6d675e, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.position.set(400, 650, 200);
    scene.add(sun);

    const root = new THREE.Group();
    root.name = "KPHX_T4_FRAME_ONLY";
    scene.add(root);

    const a1 = new THREE.Group();
    a1.name = "T4_GATE_A1_AUTHORITY";
    a1.position.fromArray(SOURCE_KPHX_A1_ORIGIN.browserPosition);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.25, 18, 18),
      new THREE.MeshStandardMaterial({ color: 0xffd100 }),
    );
    mast.position.y = 9;
    a1.add(mast);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7, 0.8, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0xffd100 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
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
      const loaded = [];

      for (const object of SOURCE_KPHX_TERMINAL4_OBJECTS) {
        const currentPosition = kphxWedToRampReadyPosition(object.latitude, object.longitude, 0);
        const verifiedPosition = sourceLocalFromVerifiedFrame(object.latitude, object.longitude);
        const delta = Math.hypot(
          currentPosition[0] - verifiedPosition[0],
          currentPosition[2] - verifiedPosition[2],
        );
        const currentYaw = kphxXPlaneHeadingToRampReadyYawRadians(object.headingDegrees);
        const verifiedYaw = THREE.MathUtils.degToRad(90 - object.headingDegrees);
        const yawDelta = Math.abs(currentYaw - verifiedYaw);

        checks.push({
          resource: object.resource,
          currentPosition,
          verifiedPosition,
          positionDeltaMeters: delta,
          currentYaw,
          verifiedYaw,
          yawDeltaRadians: yawDelta,
        });

        if (delta > 0.05) throw new Error(`${object.resource} source-frame position mismatch: ${delta.toFixed(4)}m`);
        if (yawDelta > 1e-9) throw new Error(`${object.resource} source-frame yaw mismatch`);

        const gltf = await loader.loadAsync(runtimeUrl(`/models/kphx/${object.runtime}`));
        const model = gltf.scene;
        model.name = object.name;
        model.position.fromArray(currentPosition);
        model.rotation.y = currentYaw;
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
        loaded.push(model);
      }

      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.z, 300);
      camera.position.set(center.x + span * 0.70, Math.max(180, span * 0.55), center.z + span * 0.82);
      camera.lookAt(center.x, 8, center.z);
      camera.updateProjectionMatrix();

      const surfaces = await installKphxPackageOwnedSurfaceLayer(THREE, root, {
        manifestUrl: "/models/kphx-full-airport/t4-a1-zdp-surfaces/manifest.json",
        networkUrl: "/models/kphx-full-airport/t4-a1-zdp-surfaces/surface-network.json",
        strict: true,
      });
      const zdpPlacementCount =
        Number(surfaces.layer.userData.polygonCount || 0)
        + Number(surfaces.layer.userData.drapedOrthophotoCount || 0)
        + (surfaces.network.lines || []).length;
      if (zdpPlacementCount !== 20) {
        throw new Error(`Expected 20 exact A1 ZDP surface placements, loaded ${zdpPlacementCount}`);
      }
      if (surfaces.manifest.resolvedExternalResourceCount !== 12) {
        throw new Error(`Expected 12 exact A1 ZDP surface resources, loaded ${surfaces.manifest.resolvedExternalResourceCount}`);
      }

      renderer.domElement.dataset.kphxT4FrameVerifier = "ready";
      renderer.domElement.dataset.kphxT4ObjectCount = String(loaded.length);
      renderer.domElement.dataset.kphxT4MaxPositionDeltaMeters = String(Math.max(...checks.map((c) => c.positionDeltaMeters)));
      renderer.domElement.dataset.kphxT4MaxYawDeltaRadians = String(Math.max(...checks.map((c) => c.yawDeltaRadians)));
      renderer.domElement.dataset.kphxA1Latitude = String(KPHX_FULL_AIRPORT_SOURCE.anchor.latitude);
      renderer.domElement.dataset.kphxA1Longitude = String(KPHX_FULL_AIRPORT_SOURCE.anchor.longitude);
      renderer.domElement.dataset.kphxT4Checks = JSON.stringify(checks);
      renderer.domElement.dataset.kphxA1ZdpSurfaceResources = String(surfaces.manifest.resolvedExternalResourceCount);
      renderer.domElement.dataset.kphxA1ZdpSurfacePlacements = String(zdpPlacementCount);
      renderer.domElement.dataset.kphxA1ExcludedDefaultLinePlacements = "5";
      setStatus("T4 + T4b + A1 · exact frame · 20 exact ZDP surface placements · 5 default-X-Plane lines intentionally excluded");
    };

    load().catch((error) => {
      renderer.domElement.dataset.kphxT4FrameVerifier = "error";
      renderer.domElement.dataset.kphxT4FrameError = error instanceof Error ? error.message : String(error);
      setStatus(`T4 frame failed: ${error instanceof Error ? error.message : String(error)}`);
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
