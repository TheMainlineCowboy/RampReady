import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  kphxWedToRampReadyPosition,
  kphxXPlaneHeadingToRampReadyYawRadians,
} from "../environment/kphxFullAirport/sourceAuthority.js";
import { SOURCE_KPHX_TERMINAL4_OBJECTS } from "../environment/sourceKphxTerminal4.js";

const A1_WED_OBJECT_ID = 104804;
const STOCK_FACADE_RESOURCE = "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";

function runtimeUrl(url) {
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  return base && base !== "/" ? `${base}${url}` : url;
}

function objectRuntimeUrl(objectName) {
  const stem = objectName.replace(/\.obj$/i, "");
  return runtimeUrl(`/models/kphx-xp11-jetways/objects/${stem}/${stem}.gltf`);
}

function buildFacadeWallMesh(placement, material) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vertexOffset = 0;

  for (const chunk of placement.meshChunks) {
    for (const vertex of chunk.vertices) {
      positions.push(...vertex.position);
      normals.push(...vertex.normal);
      uvs.push(...vertex.uv);
    }
    for (const index of chunk.indices) indices.push(index + vertexOffset);
    vertexOffset += chunk.vertices.length;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "KPHX_A1_XP11_Stock_Facade_WallMesh";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

async function loadFacadeMaterial() {
  const loader = new THREE.TextureLoader();
  const [albedo, lit, normal] = await Promise.all([
    loader.loadAsync(runtimeUrl("/models/kphx-xp11-jetways/textures/jetway_1_ALB.png")),
    loader.loadAsync(runtimeUrl("/models/kphx-xp11-jetways/textures/jetway_1_LIT.png")),
    loader.loadAsync(runtimeUrl("/models/kphx-xp11-jetways/textures/jetway_1_NML.png")),
  ]);

  albedo.colorSpace = THREE.SRGBColorSpace;
  lit.colorSpace = THREE.SRGBColorSpace;
  normal.colorSpace = THREE.NoColorSpace;

  // TextureLoader's default Y flip matches X-Plane's lower-left UV convention
  // for this directly-authored facade mesh. No UV coordinates are rewritten.
  return new THREE.MeshStandardMaterial({
    name: "XP11 jetway_1_solid.fac wall material",
    map: albedo,
    emissiveMap: lit,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1,
    normalMap: normal,
    alphaTest: 0.5,
    transparent: false,
    side: THREE.FrontSide,
    metalness: 0,
    roughness: 1,
  });
}

export default function KphxA1JetwayVerifier() {
  const mountRef = useRef(null);
  const [status, setStatus] = useState("Loading exact XP11 A1 jetway…");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const params = new URLSearchParams(window.location.search);
    const view = params.get("view") || "oblique";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb7d0e2);
    scene.fog = new THREE.Fog(0xb7d0e2, 350, 1400);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "kphxA1JetwayVerifierCanvas";
    renderer.domElement.dataset.kphxA1JetwayVerifier = "loading";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x66615b, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 3.0);
    sun.position.set(120, 250, 140);
    scene.add(sun);

    const root = new THREE.Group();
    root.name = "KPHX_A1_EXACT_XP11_STOCK_JETWAY_VERIFIER";
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

    const animate = () => {
      if (disposed) return;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const load = async () => {
      const gltfLoader = new GLTFLoader();

      for (const object of SOURCE_KPHX_TERMINAL4_OBJECTS) {
        const gltf = await gltfLoader.loadAsync(runtimeUrl(`/models/kphx/${object.runtime}`));
        const model = gltf.scene;
        model.name = object.name;
        model.position.fromArray(kphxWedToRampReadyPosition(object.latitude, object.longitude, 0));
        model.rotation.y = kphxXPlaneHeadingToRampReadyYawRadians(object.headingDegrees);
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

      const layoutResponse = await fetch(
        runtimeUrl("/models/kphx-xp11-jetways/layout.exact.json"),
        { cache: "no-store" },
      );
      if (!layoutResponse.ok) throw new Error(`Jetway layout HTTP ${layoutResponse.status}`);
      const layout = await layoutResponse.json();

      if (layout.facadeResource !== STOCK_FACADE_RESOURCE) {
        throw new Error(`Unexpected facade resource ${layout.facadeResource}`);
      }
      if (layout.isRing !== false) throw new Error("XP11 stock jetway facade must remain RING 0");
      if (layout.placements.length !== 108) {
        throw new Error(`Expected 108 authored stock jetways, got ${layout.placements.length}`);
      }

      const a1 = layout.placements.find((entry) => entry.wedObjectId === A1_WED_OBJECT_ID);
      if (!a1 || a1.blockedExactCurve) throw new Error("A1 exact stock facade is unavailable");
      if (a1.nodeCount !== 7 || a1.wallCount !== 6 || a1.edges.length !== 6) {
        throw new Error("A1 WED open-chain contract failed");
      }
      const wallSequence = a1.edges.map((edge) => edge.wallType).join(",");
      if (wallSequence !== "Wall 1,Wall 1,Wall 1,Wall 1,Wall 5,Wall 4") {
        throw new Error(`A1 wall sequence mismatch: ${wallSequence}`);
      }
      if (a1.objectInstances.length !== 16) {
        throw new Error(`Expected 16 A1 stock object attachments, got ${a1.objectInstances.length}`);
      }

      const jetway = new THREE.Group();
      jetway.name = "KPHX_A1_XP11_Jetway_1_solid_Facade";
      root.add(jetway);

      const wallMaterial = await loadFacadeMaterial();
      jetway.add(buildFacadeWallMesh(a1, wallMaterial));

      const uniqueObjects = [...new Set(a1.objectInstances.map((entry) => entry.object))];
      const prototypes = new Map();
      for (const objectName of uniqueObjects) {
        const gltf = await gltfLoader.loadAsync(objectRuntimeUrl(objectName));
        const prototype = gltf.scene;
        prototype.name = `XP11_${objectName}`;
        prototype.traverse((node) => {
          if (!node.isMesh) return;
          node.castShadow = true;
          node.receiveShadow = true;
        });
        prototypes.set(objectName, prototype);
      }

      for (const instance of a1.objectInstances) {
        const model = prototypes.get(instance.object).clone(true);
        model.name = `A1_${instance.edgeIndex}_${instance.templateIndex}_${instance.object}`;
        model.position.fromArray(instance.position);
        model.rotation.y = instance.yawRadians;
        jetway.add(model);
      }

      const pathPoints = a1.edges.map((edge) => new THREE.Vector3(edge.start[0], 0.12, edge.start[1]));
      const last = a1.edges.at(-1).end;
      pathPoints.push(new THREE.Vector3(last[0], 0.12, last[1]));
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
      const pathLine = new THREE.Line(
        pathGeometry,
        new THREE.LineBasicMaterial({ color: 0x00ffff }),
      );
      pathLine.name = "KPHX_A1_RAW_WED_OPEN_PATH";
      root.add(pathLine);

      root.updateMatrixWorld(true);
      const jetwayBounds = new THREE.Box3().setFromObject(jetway);
      if (jetwayBounds.isEmpty()) throw new Error("A1 stock jetway rendered empty");
      const center = jetwayBounds.getCenter(new THREE.Vector3());
      const size = jetwayBounds.getSize(new THREE.Vector3());

      if (view === "top") {
        camera.position.set(center.x, Math.max(55, size.length() * 1.3), center.z + 0.01);
        camera.up.set(0, 0, -1);
      } else if (view === "terminal") {
        const connection = a1.edges[0].start;
        camera.position.set(connection[0] + 18, 14, connection[1] - 25);
        camera.lookAt(connection[0], 5.2, connection[1] - 1.5);
      } else {
        camera.position.set(center.x + 44, 24, center.z + 48);
        camera.lookAt(center.x, Math.max(4.5, center.y), center.z);
      }
      if (view === "top") {
        camera.lookAt(center.x, Math.max(4.5, center.y), center.z);
      }
      camera.updateProjectionMatrix();

      const blocked = layout.placements.filter((entry) => entry.blockedExactCurve);
      renderer.domElement.dataset.kphxA1JetwayVerifier = "ready";
      renderer.domElement.dataset.kphxA1FacadeResource = layout.facadeResource;
      renderer.domElement.dataset.kphxA1WedObjectId = String(a1.wedObjectId);
      renderer.domElement.dataset.kphxA1NodeCount = String(a1.nodeCount);
      renderer.domElement.dataset.kphxA1WallCount = String(a1.wallCount);
      renderer.domElement.dataset.kphxA1ObjectInstanceCount = String(a1.objectInstances.length);
      renderer.domElement.dataset.kphxJetwaySourcePlacementCount = String(layout.placements.length);
      renderer.domElement.dataset.kphxJetwayReadyStraightPlacementCount = String(
        layout.placements.length - blocked.length,
      );
      renderer.domElement.dataset.kphxJetwayBlockedCurveIds = blocked.map((entry) => entry.wedObjectId).join(",");
      renderer.domElement.dataset.kphxLegacyAirportJetwayGlbLoaded = "false";
      renderer.domElement.dataset.kphxA1WallSequence = wallSequence;
      renderer.domElement.dataset.kphxA1View = view;
      renderer.domElement.dataset.kphxA1BoundsMin = jetwayBounds.min.toArray().join(",");
      renderer.domElement.dataset.kphxA1BoundsMax = jetwayBounds.max.toArray().join(",");
      setStatus(`A1 exact XP11 stock facade · 6 WED walls · 16 stock OBJ attachments · ${view}`);
    };

    load().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      renderer.domElement.dataset.kphxA1JetwayVerifier = "error";
      renderer.domElement.dataset.kphxA1JetwayError = message;
      setStatus(`A1 exact XP11 jetway failed: ${message}`);
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
