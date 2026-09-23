import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SOURCE_KPHX_TERMINAL4_OBJECTS } from "../environment/sourceKphxTerminal4.js";
import {
  kphxWedToRampReadyPosition,
  kphxXPlaneHeadingToRampReadyYawRadians,
} from "../environment/kphxFullAirport/sourceAuthority.js";
import A1_SOURCE_AUTHORITY from "../../reports/kphx-a1-source-jetway-authority.json";
import { applyExactXp11Obj8MaskCompatibility } from "../environment/kphxFullAirport/obj8RenderCompatibility.js";

const EXPECTED_WALL_SEQUENCE = [
  "Rotunda_extension",
  "Rotunda_extension",
  "Rotunda_extension",
  "Rotunda_extension",
  "Tunnel_11-15.5m",
  "Cabin",
];

function runtimeUrl(url) {
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  return base && base !== "/" ? `${base}${url}` : url;
}

function chooseSpelling(wall, edgeLength, segmentByIndex) {
  const candidates = wall.spellings.map((spelling, order) => {
    const nominalLength = spelling.reduce((sum, index) => {
      const segment = segmentByIndex.get(index);
      if (!segment) throw new Error(`FAC wall ${wall.name} references missing segment ${index}`);
      return sum + segment.nominalLengthMeters;
    }, 0);
    return {
      order,
      spelling,
      nominalLength,
      error: Math.abs(nominalLength - edgeLength),
    };
  });
  candidates.sort((a, b) => a.error - b.error || a.order - b.order);
  if (!candidates.length) throw new Error(`FAC wall ${wall.name} has no spellings`);
  return candidates[0];
}

function xPlaneFacadeIndicesToThree(indices) {
  if (indices.length % 3 !== 0) {
    throw new Error(`FAC index count is not triangle-aligned: ${indices.length}`);
  }

  const converted = [];
  for (let index = 0; index < indices.length; index += 3) {
    // X-Plane FAC triangle winding is opposite Three.js/glTF front-face winding.
    // Swap the second and third index only; authored positions/normals/UVs stay unchanged.
    converted.push(indices[index], indices[index + 2], indices[index + 1]);
  }
  return converted;
}

function makeFacadeMesh(segment, meshDefinition, stretch, cumulative, material) {
  const positions = [];
  const normals = [];
  const uvs = [];

  for (const vertex of meshDefinition.vertices) {
    const [x, y, z, nx, ny, nz, s, t] = vertex;
    positions.push(x, y, -cumulative + z * stretch);
    normals.push(nx, ny, nz);
    uvs.push(s, t);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(xPlaneFacadeIndicesToThree(meshDefinition.indices));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `XP11_FAC_Segment_${segment.index}_Group_${meshDefinition.group}`;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

export default function KphxA1StockJetwayVerifier() {
  const mountRef = useRef(null);
  const [status, setStatus] = useState("Loading exact XP11 stock A1 jetway…");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb9d1e3);
    scene.fog = new THREE.Fog(0xb9d1e3, 400, 1200);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "kphxA1StockJetwayVerifierCanvas";
    renderer.domElement.dataset.kphxA1StockJetwayVerifier = "loading";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x67625c, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 3.0);
    sun.position.set(150, 300, 180);
    scene.add(sun);

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

    const draw = () => {
      if (disposed) return;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(draw);
    };
    draw();

    const load = async () => {
      const gltfLoader = new GLTFLoader();
      const textureLoader = new THREE.TextureLoader();

      const [manifestResponse, facadeSourceResponse] = await Promise.all([
        fetch(runtimeUrl("/models/kphx-stock-jetways/manifest.json"), { cache: "no-store" }),
        fetch(runtimeUrl("/models/kphx-stock-jetways/jetway_1_solid.fac"), { cache: "no-store" }),
      ]);
      if (!manifestResponse.ok) throw new Error(`Stock jetway manifest HTTP ${manifestResponse.status}`);
      if (!facadeSourceResponse.ok) throw new Error(`Stock jetway facade HTTP ${facadeSourceResponse.status}`);
      const [manifest, facadeSourceText] = await Promise.all([
        manifestResponse.json(),
        facadeSourceResponse.text(),
      ]);
      const wallNoBlend = facadeSourceText.match(/^NO_BLEND(?:\\s+([0-9.]+))?\\s*$/m);
      const wallAlphaCutoff = wallNoBlend ? Number(wallNoBlend[1] ?? 0.5) : null;
      const authority = A1_SOURCE_AUTHORITY;

      if (manifest.ringMode !== 0) throw new Error(`Stock jetway must be RING 0, received ${manifest.ringMode}`);
      if (manifest.objects?.length !== 18) throw new Error(`Stock jetway OBJ count changed: ${manifest.objects?.length}`);
      if (manifest.segments?.length !== 24) throw new Error(`Stock jetway segment count changed: ${manifest.segments?.length}`);
      if (manifest.walls?.length !== 10) throw new Error(`Stock jetway wall count changed: ${manifest.walls?.length}`);

      const t4b = SOURCE_KPHX_TERMINAL4_OBJECTS.find((entry) => entry.resource === "Terminals/Terminal4b.obj");
      if (!t4b) throw new Error("Exact Terminal4b source record missing");
      const terminalGltf = await gltfLoader.loadAsync(runtimeUrl(`/models/kphx/${t4b.runtime}`));
      const terminal = terminalGltf.scene;
      applyExactXp11Obj8MaskCompatibility(THREE, terminal, {
        label: t4b.resource,
        alphaCutoff: 0.5,
        windingAlreadyConverted: false,
        correctLegacyTextureV: true,
      });
      terminal.name = t4b.name;
      terminal.position.fromArray(kphxWedToRampReadyPosition(t4b.latitude, t4b.longitude, 0));
      terminal.rotation.y = kphxXPlaneHeadingToRampReadyYawRadians(t4b.headingDegrees);
      terminal.traverse((node) => {
        if (!node.isMesh) return;
        node.receiveShadow = true;
        node.castShadow = true;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (material?.map) material.map.colorSpace = THREE.SRGBColorSpace;
        }
      });
      scene.add(terminal);

      const [diffuse, lit, normal] = await Promise.all([
        textureLoader.loadAsync(runtimeUrl("/models/kphx-stock-jetways/jetway_1_ALB.png")),
        textureLoader.loadAsync(runtimeUrl("/models/kphx-stock-jetways/jetway_1_LIT.png")),
        textureLoader.loadAsync(runtimeUrl("/models/kphx-stock-jetways/jetway_1_NML.png")),
      ]);
      diffuse.colorSpace = THREE.SRGBColorSpace;
      lit.colorSpace = THREE.SRGBColorSpace;

      const facadeMaterial = new THREE.MeshStandardMaterial({
        map: diffuse,
        normalMap: normal,
        emissiveMap: lit,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 1,
        roughness: 0.75,
        metalness: 0,
        transparent: wallAlphaCutoff === null,
        alphaTest: wallAlphaCutoff ?? 0,
        depthWrite: true,
        side: THREE.FrontSide,
      });

      const segmentByIndex = new Map(manifest.segments.map((segment) => [segment.index, segment]));
      const wallByIndex = new Map(manifest.walls.map((wall) => [wall.index, wall]));
      const nodes = authority.jetwayFacade.nodes;
      if (nodes.length !== 7) throw new Error(`A1 WED node count changed: ${nodes.length}`);

      const points = nodes.map((node) => {
        const [x, y, z] = kphxWedToRampReadyPosition(node.latitude, node.longitude, 0);
        return new THREE.Vector3(x, y, z);
      });

      const selectedEdges = [];
      const neededObjectIndices = new Set();
      for (let edgeIndex = 0; edgeIndex < points.length - 1; edgeIndex += 1) {
        const p0 = points[edgeIndex];
        const p1 = points[edgeIndex + 1];
        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;
        const edgeLength = Math.hypot(dx, dz);
        const wallNumber = Number(String(nodes[edgeIndex].wallType).replace(/\D+/g, ""));
        const wallIndex = wallNumber - 1;
        const wall = wallByIndex.get(wallIndex);
        if (!wall) throw new Error(`A1 edge ${edgeIndex + 1} references missing Wall ${wallNumber}`);
        const selected = chooseSpelling(wall, edgeLength, segmentByIndex);
        for (const segmentIndex of selected.spelling) {
          for (const attachment of segmentByIndex.get(segmentIndex)?.attachments || []) {
            neededObjectIndices.add(attachment.objectIndex);
          }
        }
        selectedEdges.push({
          edgeIndex,
          p0,
          p1,
          dx,
          dz,
          edgeLength,
          wallNumber,
          wallIndex,
          wall,
          selected,
        });
      }

      const wallSequence = selectedEdges.map((entry) => entry.wall.name);
      if (JSON.stringify(wallSequence) !== JSON.stringify(EXPECTED_WALL_SEQUENCE)) {
        throw new Error(`A1 stock FAC wall sequence mismatch: ${wallSequence.join(" | ")}`);
      }

      const objectPrototypeByIndex = new Map();
      await Promise.all([...neededObjectIndices].map(async (index) => {
        const record = manifest.objects[index];
        if (!record || record.index !== index) throw new Error(`Missing stock OBJ manifest index ${index}`);
        const gltf = await gltfLoader.loadAsync(runtimeUrl(`/models/kphx-stock-jetways/${record.runtimeGltf}`));
        applyExactXp11Obj8MaskCompatibility(THREE, gltf.scene, {
          label: record.sourceName,
          alphaCutoff: 0.5,
          windingAlreadyConverted: false,
        });
        objectPrototypeByIndex.set(index, gltf.scene);
      }));

      const jetwayRoot = new THREE.Group();
      jetwayRoot.name = "KPHX_A1_XP11_STOCK_JETWAY_1_SOLID_FAC";
      let attachmentCount = 0;
      const spellingRecords = [];

      for (const edge of selectedEdges) {
        const tangentX = edge.dx / edge.edgeLength;
        const tangentZ = edge.dz / edge.edgeLength;
        const edgeGroup = new THREE.Group();
        edgeGroup.name = `A1_FAC_Edge_${edge.edgeIndex + 1}_${edge.wall.name}`;
        edgeGroup.position.copy(edge.p0);
        edgeGroup.rotation.y = Math.atan2(-tangentX, -tangentZ);

        const stretch = edge.edgeLength / edge.selected.nominalLength;
        let cumulative = 0;

        for (const segmentIndex of edge.selected.spelling) {
          const segment = segmentByIndex.get(segmentIndex);
          if (!segment) throw new Error(`Missing FAC segment ${segmentIndex}`);

          for (const meshDefinition of segment.meshes) {
            edgeGroup.add(makeFacadeMesh(segment, meshDefinition, stretch, cumulative, facadeMaterial));
          }

          for (const attachment of segment.attachments || []) {
            const prototype = objectPrototypeByIndex.get(attachment.objectIndex);
            if (!prototype) throw new Error(`FAC segment ${segmentIndex} missing OBJ ${attachment.objectIndex}`);
            const instance = prototype.clone(true);
            instance.name = `A1_FAC_OBJ_${attachment.objectIndex}_Segment_${segmentIndex}`;
            instance.position.set(
              attachment.x,
              attachment.y,
              -cumulative + attachment.z * stretch,
            );
            instance.rotation.y = THREE.MathUtils.degToRad(attachment.headingDegrees);
            instance.traverse((node) => {
              if (!node.isMesh) return;
              node.receiveShadow = true;
              node.castShadow = true;
            });
            edgeGroup.add(instance);
            attachmentCount += 1;
          }

          cumulative += segment.nominalLengthMeters * stretch;
        }

        spellingRecords.push({
          edge: edge.edgeIndex + 1,
          wall: edge.wall.name,
          length: edge.edgeLength,
          nominal: edge.selected.nominalLength,
          stretch,
          spelling: edge.selected.spelling,
        });
        jetwayRoot.add(edgeGroup);
      }
      scene.add(jetwayRoot);

      const pathGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const pathLine = new THREE.Line(
        pathGeometry,
        new THREE.LineBasicMaterial({ color: 0x00ffff }),
      );
      pathLine.name = "KPHX_A1_WED_OPEN_FACADE_PATH";
      scene.add(pathLine);

      const pointCenter = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
      camera.position.set(pointCenter.x + 42, 28, pointCenter.z + 48);
      camera.lookAt(pointCenter.x, 4.5, pointCenter.z);
      camera.updateProjectionMatrix();

      renderer.domElement.dataset.kphxA1StockJetwayVerifier = "ready";
      renderer.domElement.dataset.kphxA1StockResource = authority.jetwayFacade.resource;
      renderer.domElement.dataset.kphxA1StockFacadeWedObjectId = String(authority.jetwayFacade.wedObjectId);
      renderer.domElement.dataset.kphxA1StockNodeCount = String(nodes.length);
      renderer.domElement.dataset.kphxA1StockEdgeCount = String(selectedEdges.length);
      renderer.domElement.dataset.kphxA1StockRingMode = String(manifest.ringMode);
      renderer.domElement.dataset.kphxA1StockWallSequence = wallSequence.join("|");
      renderer.domElement.dataset.kphxA1StockAttachmentCount = String(attachmentCount);
      renderer.domElement.dataset.kphxA1StockObjectPrototypeCount = String(objectPrototypeByIndex.size);
      renderer.domElement.dataset.kphxA1StockFacadeSha256 = manifest.sourceFacadeSha256;
      renderer.domElement.dataset.kphxA1FacadeWinding = "xplane-to-three-reversed";
      renderer.domElement.dataset.kphxA1FacadeBlendMode = wallAlphaCutoff === null ? "source-blend" : `source-no-blend-${wallAlphaCutoff}`;
      renderer.domElement.dataset.kphxA1StockSpellings = JSON.stringify(spellingRecords);
      renderer.domElement.dataset.kphxA1OldUploadedGlbUsed = "false";

      setStatus(`A1 exact XP11 stock jetway · open 7-node FAC · ${attachmentCount} stock OBJ attachments`);
    };

    load().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      renderer.domElement.dataset.kphxA1StockJetwayVerifier = "error";
      renderer.domElement.dataset.kphxA1StockJetwayError = message;
      setStatus(`A1 stock jetway failed: ${message}`);
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
        position: "absolute",
        left: 16,
        top: 16,
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(0,0,0,.78)",
        color: "white",
        font: "600 13px/1.35 system-ui, sans-serif",
        pointerEvents: "none",
      }}>{status}</div>
    </main>
  );
}
