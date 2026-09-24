import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const parsedFacadeCache = new Map();
const sharedFacadeAssetCache = new Map();

function runtimeUrl(url) {
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  const clean = String(url).startsWith("/") ? url : `/${url}`;
  return base && base !== "/" ? `${base}${clean}` : clean;
}

function normalized(v) {
  const out = v.clone();
  const len = out.length();
  if (len > 0) out.multiplyScalar(1 / len);
  return out;
}
function perpCw(v) { return new THREE.Vector2(v.y, -v.x); }
function perpCcw(v) { return new THREE.Vector2(-v.y, v.x); }
function closerTo(a, b, x) { return Math.abs(x - a) > Math.abs(x - b); }
function clampIndex(v, max) { return Math.max(0, Math.min(max, v)); }

function reverseIndexedTriangleWinding(geometry) {
  const index = geometry?.getIndex?.();
  if (!index) throw new Error("Exact XP11 stock jetway OBJ lost its indexed triangle topology");
  if (index.count % 3 !== 0) throw new Error("Exact XP11 stock jetway OBJ index count is not triangle-aligned");
  const array = index.array;
  for (let cursor = 0; cursor < index.count; cursor += 3) {
    const tmp = array[cursor + 1];
    array[cursor + 1] = array[cursor + 2];
    array[cursor + 2] = tmp;
  }
  index.needsUpdate = true;
}

function normalizeLegacyStockObj8Gltf(THREE, gltf) {
  const policy = String(gltf?.parser?.json?.extras?.geometryPolicy || "");
  const alreadyConverted = policy.includes("glTF-counterclockwise-winding");
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    if (!alreadyConverted) reverseIndexedTriangleWinding(node.geometry);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.side = THREE.FrontSide;
      material.transparent = false;
      material.alphaTest = 0.5;
      material.depthTest = true;
      material.depthWrite = true;
      material.needsUpdate = true;
    }
  });
  gltf.scene.userData.xPlaneObj8Winding = alreadyConverted
    ? "converter-counterclockwise"
    : "legacy-runtime-clockwise-to-counterclockwise";
  gltf.scene.userData.xPlaneBlendMode = "GLOBAL_no_blend 0.5";
  gltf.scene.userData.xPlaneCullMode = "default-one-sided";
  return gltf.scene;
}

export function parseXp11Type2Facade(source) {
  const objects = [];
  const templates = [];
  const walls = [];
  let currentTemplate = null;
  let currentMesh = null;
  let currentWall = null;
  let curved = false;
  let ringMode = 1;
  let shaderTarget = "wall";
  const wallShader = { alphaMode: "BLEND", alphaCutoff: null };

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const p = line.split(/\s+/);
    const cmd = p[0];

    if (cmd === "RING") {
      ringMode = Number(p[1]);
    } else if (cmd === "SHADER_WALL") {
      shaderTarget = "wall";
    } else if (cmd === "SHADER_ROOF") {
      shaderTarget = "roof";
    } else if (cmd === "NO_BLEND" && shaderTarget === "wall") {
      const cutoff = Number(p[1]);
      wallShader.alphaMode = "MASK";
      wallShader.alphaCutoff = Number.isFinite(cutoff) ? cutoff : 0.5;
    } else if (cmd === "OBJ") {
      objects.push(p.slice(1).join(" "));
    } else if (cmd === "SEGMENT") {
      curved = false;
      const index = Number(p[1]);
      currentTemplate = templates[index] ||= { index, meshes: [], attachments: [], boundsZ: 0 };
      currentMesh = null;
    } else if (cmd === "SEGMENT_CURVED") {
      curved = true;
      currentTemplate = null;
      currentMesh = null;
    } else if (!curved && cmd === "MESH" && currentTemplate) {
      currentMesh = { positions: [], normals: [], uvs: [], indices: [] };
      currentTemplate.meshes.push(currentMesh);
    } else if (!curved && cmd === "VERTEX" && currentMesh) {
      currentMesh.positions.push(Number(p[1]), Number(p[2]), Number(p[3]));
      currentMesh.normals.push(Number(p[4]), Number(p[5]), Number(p[6]));
      currentMesh.uvs.push(Number(p[7]), Number(p[8]));
    } else if (!curved && cmd === "IDX" && currentMesh) {
      currentMesh.indices.push(...p.slice(1).map(Number));
    } else if (!curved && cmd === "ATTACH_GRADED" && currentTemplate) {
      currentTemplate.attachments.push({
        objectIndex: Number(p[1]),
        x: Number(p[2]), y: Number(p[3]), z: Number(p[4]), heading: Number(p[5]),
        showLow: p[6] == null ? 1 : Number(p[6]),
        showHigh: p[7] == null ? 1 : Number(p[7]),
      });
    } else if (cmd === "WALL") {
      currentWall = { name: p.slice(5).join(" ") || `Wall ${walls.length + 1}`, spellings: [] };
      walls.push(currentWall);
      currentTemplate = null;
      currentMesh = null;
      curved = false;
    } else if (cmd === "SPELLING" && currentWall) {
      currentWall.spellings.push({ indices: p.slice(1).map(Number), total: 0 });
    }
  }

  for (const t of templates) {
    if (!t) continue;
    let minZ = Infinity, maxZ = -Infinity;
    for (const m of t.meshes) {
      for (let i = 2; i < m.positions.length; i += 3) {
        minZ = Math.min(minZ, m.positions[i]);
        maxZ = Math.max(maxZ, m.positions[i]);
      }
    }
    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ) || maxZ <= minZ) {
      throw new Error(`Facade segment ${t.index} has invalid Z bounds`);
    }
    t.boundsZ = maxZ - minZ;
    // Laminar WED ResourceMgr right-adjusts each template so its maximum Z is exactly zero.
    for (const m of t.meshes) {
      for (let i = 2; i < m.positions.length; i += 3) m.positions[i] -= maxZ;
    }
  }

  for (const wall of walls) {
    for (const spelling of wall.spellings) {
      spelling.total = spelling.indices.reduce((sum, i) => sum + templates[i].boundsZ, 0);
    }
    wall.spellings.sort((a, b) => a.total - b.total);
  }
  return { objects, templates, walls, ringMode, wallShader };
}

export function pickLaminarWedSpelling(spellings, lengthMeters) {
  if (!spellings?.length) throw new Error("Facade wall has no spellings");
  const out = { indices: [], total: 0 };
  while (true) {
    if (out.total + spellings.at(-1).total < lengthMeters) {
      const low = clampIndex(Math.floor(spellings.length / 4), spellings.length - 1);
      const high = clampIndex(Math.floor(spellings.length * 3 / 4), spellings.length - 1);
      const choice = Math.floor((low + high) / 2); // exact WED preview int_seedrand behavior
      out.indices.push(...spellings[choice].indices);
      out.total += spellings[choice].total;
    } else {
      let best = -1;
      for (let n = spellings.length - 1; n >= 0; n -= 1) {
        if (closerTo(out.total, out.total + spellings[n].total, lengthMeters)) {
          if (best === -1 || closerTo(out.total + spellings[best].total, out.total + spellings[n].total, lengthMeters)) {
            best = n;
            if (out.total + spellings[n].total < lengthMeters) break;
          }
        }
      }
      if (best === -1) break;
      out.indices.push(...spellings[best].indices);
      out.total += spellings[best].total;
      break;
    }
  }
  if (!out.indices.length) {
    out.indices.push(...spellings[0].indices);
    out.total = spellings[0].total;
  }
  return out;
}

function xPlaneFacadeIndicesToThree(indices) {
  if (indices.length % 3 !== 0) {
    throw new Error(`Facade index count is not triangle-aligned: ${indices.length}`);
  }
  const converted = [];
  for (let index = 0; index < indices.length; index += 3) {
    converted.push(indices[index], indices[index + 2], indices[index + 1]);
  }
  return converted;
}

function meshGeometry(templateMesh, boundsZ, miFirst, miLast, isFirst, isLast) {
  const pos = templateMesh.positions.slice();
  if (isFirst || isLast) {
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      let z = pos[i + 2];
      if (isFirst) z += miFirst * x * (1 + z / boundsZ);
      if (isLast) z += miLast * x * z / boundsZ;
      pos[i + 2] = z;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(templateMesh.normals, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(templateMesh.uvs, 2));
  g.setIndex(xPlaneFacadeIndicesToThree(templateMesh.indices));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

async function loadSharedFacadeAssets(facade, basePath) {
  const key = `${basePath}|${facade.objects.join("|")}|${JSON.stringify(facade.wallShader)}`;
  if (!sharedFacadeAssetCache.has(key)) {
    sharedFacadeAssetCache.set(key, (async () => {
      const loader = new GLTFLoader();
      const textureLoader = new THREE.TextureLoader();
      const [pairs, diffuse, lit, normal] = await Promise.all([
        Promise.all(facade.objects.map(async (fileName, index) => {
          const stem = fileName.replace(/\.obj$/i, "");
          const gltf = await loader.loadAsync(runtimeUrl(`${basePath}/objects/${stem}.gltf`));
          return [index, gltf.scene];
        })),
        textureLoader.loadAsync(runtimeUrl(`${basePath}/textures/jetway_1_ALB.png`)),
        textureLoader.loadAsync(runtimeUrl(`${basePath}/textures/jetway_1_LIT.png`)),
        textureLoader.loadAsync(runtimeUrl(`${basePath}/textures/jetway_1_NML.png`)),
      ]);
      diffuse.colorSpace = THREE.SRGBColorSpace;
      lit.colorSpace = THREE.SRGBColorSpace;
      const wallMaterial = new THREE.MeshStandardMaterial({
        map: diffuse,
        emissiveMap: lit,
        emissive: new THREE.Color(1, 1, 1),
        normalMap: normal,
        roughness: 1,
        metalness: 0,
        side: THREE.FrontSide,
        transparent: facade.wallShader.alphaMode === "BLEND",
        alphaTest: facade.wallShader.alphaMode === "MASK" ? facade.wallShader.alphaCutoff : 0,
        depthWrite: true,
      });
      return {
        objectPrototypes: new Map(pairs),
        diffuse,
        lit,
        normal,
        wallMaterial,
      };
    })());
  }
  return sharedFacadeAssetCache.get(key);
}

export async function buildXp11Type2Facade({
  facadeText,
  footprint,
  wallChoices,
  basePath = "/models/xplane11-stock/jetway1",
}) {
  let facade = parsedFacadeCache.get(facadeText);
  if (!facade) {
    facade = parseXp11Type2Facade(facadeText);
    parsedFacadeCache.set(facadeText, facade);
  }
  if (footprint.length !== wallChoices.length) throw new Error("Facade footprint/wall choice count mismatch");
  const wallCount = facade.ringMode === 0 ? footprint.length - 1 : footprint.length;
  if (wallCount < 1) throw new Error("Facade has no renderable wall segments");

  const {
    objectPrototypes,
    wallMaterial,
  } = await loadSharedFacadeAssets(facade, basePath);

  const root = new THREE.Group();
  root.name = "XP11_Jetway_1_solid_fac_exact";
  const wallEvidence = [];
  const n = footprint.length;

  for (let w = 0; w < wallCount; w += 1) {
    const p1 = footprint[w];
    const p2 = footprint[w + 1 < n ? w + 1 : 0];
    const segDirRaw = new THREE.Vector2(p2.x - p1.x, p2.y - p1.y);
    const wallLength = segDirRaw.length();
    const segDir = normalized(segDirRaw);
    const perpDir = perpCw(segDir);
    const wallIndex = clampIndex(wallChoices[w], facade.walls.length - 1);
    const wall = facade.walls[wallIndex];
    const spelling = pickLaminarWedSpelling(wall.spellings, wallLength);
    const stretch = wallLength / spelling.total;

    let miFirst = 0;
    let miLast = 0;

    if (facade.ringMode !== 0 || w > 0) {
      const prev = footprint[(w - 1 + n) % n];
      const prevDir = normalized(new THREE.Vector2(p1.x - prev.x, p1.y - prev.y));
      let tangent = normalized(prevDir.clone().add(segDir));
      let miter = perpCcw(tangent);
      miter.multiplyScalar(1 / miter.dot(perpDir));
      miFirst = miter.dot(segDir);
    }

    if (facade.ringMode !== 0 || w < wallCount - 1) {
      const p3 = footprint[(w + 2) % n];
      const nextDir = normalized(new THREE.Vector2(p3.x - p2.x, p3.y - p2.y));
      const tangent = normalized(nextDir.clone().add(segDir));
      const miter = perpCcw(tangent);
      miter.multiplyScalar(1 / miter.dot(perpDir));
      miLast = -miter.dot(segDir);
    }

    const wallGroup = new THREE.Group();
    wallGroup.name = `Wall_${w + 1}_${wall.name}`;
    wallGroup.position.set(p1.x, 0, p1.y);
    wallGroup.rotation.y = Math.atan2(perpDir.y, -perpDir.x);
    wallGroup.scale.z = stretch;
    root.add(wallGroup);

    let cursor = 0;
    spelling.indices.forEach((templateIndex, spellingIndex) => {
      const t = facade.templates[templateIndex];
      const segmentGroup = new THREE.Group();
      segmentGroup.name = `Segment_${templateIndex}_${spellingIndex}`;
      segmentGroup.position.z = -cursor;
      wallGroup.add(segmentGroup);

      t.meshes.forEach((m, mi) => {
        const g = meshGeometry(t.meshes[mi], t.boundsZ, miFirst, miLast, spellingIndex === 0, spellingIndex === spelling.indices.length - 1);
        const mesh = new THREE.Mesh(g, wallMaterial);
        mesh.name = `FacadeMesh_${templateIndex}_${mi}`;
        // The stock jetway facade's flat wall polygons are placement/control
        // surfaces behind the attached 3D rotunda/tunnel/cabin objects. In the
        // standalone browser renderer they appear edge-on as razor-thin slabs
        // at every gate. Preserve them in the exact hierarchy for source
        // evidence, but do not render or cast them.
        mesh.visible = false;
        mesh.userData.kphxStockJetwayFacadePlaneHidden = true;
        mesh.receiveShadow = false;
        mesh.castShadow = false;
        segmentGroup.add(mesh);
      });

      for (const a of t.attachments) {
        const proto = objectPrototypes.get(a.objectIndex);
        if (!proto) throw new Error(`Missing facade OBJ prototype ${a.objectIndex}`);
        const cancelStretch = new THREE.Group();
        cancelStretch.name = `AttachCancelStretch_${a.objectIndex}`;
        cancelStretch.scale.z = 1 / stretch;
        segmentGroup.add(cancelStretch);

        const pivot = new THREE.Group();
        pivot.position.set(a.x, a.y, a.z * stretch);
        pivot.rotation.y = THREE.MathUtils.degToRad(-a.heading);
        cancelStretch.add(pivot);

        const model = proto.clone(true);
        model.name = `Attached_${facade.objects[a.objectIndex]}`;
        model.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        pivot.add(model);
      }
      cursor += t.boundsZ;
    });

    wallEvidence.push({
      wallNumber: w + 1,
      wallChoiceSource: wallChoices[w] + 1,
      wallName: wall.name,
      wallLength,
      spelling: spelling.indices,
      spellingNominalLength: spelling.total,
      stretch,
      miFirst,
      miLast,
    });
  }

  root.userData.xPlaneFacadeAuthority = "Laminar WED type-2 preview transform order";
  root.userData.xPlaneFacadeWallShader = facade.wallShader;
  root.userData.xPlaneFacadeRingMode = facade.ringMode;
  root.userData.renderedWallCount = wallCount;
  root.userData.wallEvidence = wallEvidence;
  return { root, facade, wallEvidence };
}
