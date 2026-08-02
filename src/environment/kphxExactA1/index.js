import part00 from "./part00.js";
import part01 from "./part01.js";
import part02 from "./part02.js";
import part03 from "./part03.js";
import part04 from "./part04.js";
import part05 from "./part05.js";
import part06 from "./part06.js";

const PAYLOAD_PARTS = Object.freeze([part00, part01, part02, part03, part04, part05, part06]);

export const EXACT_KPHX_A1_PROFILE = Object.freeze({
  source: "unmlobo-kphx1-8-1_Mu9aq.zip",
  archiveSha256: "d118f396081b5faabc81daf3786a0c56e3c0f7b4c9b7d6cbe7ce13c10efe05bc",
  airportBglSha256: "1ea4978b5a89ecf5efebe522c9837e9d89de6f7a45dc4e99bfe161a8343ed2a2",
  anchorGate: "A1",
  anchorLongitude: -111.99876129627228,
  anchorLatitude: 33.436546325683594,
  anchorHeadingDegrees: 270.4908752441406,
  radiusMeters: 450,
  projectedMeshCount: 73,
  paintedLineCount: 214,
  detailLevel: "unmlobo-kphx-v181-exact-a1-source-v3-pavement-coincident",
  paintedLineBaseHeightMeters: 0.004,
});

const LIGHTED_OFFSET = 21;

async function decodePayload() {
  if (typeof DecompressionStream !== "function") {
    throw new Error("This browser does not support the gzip decoder required by the exact KPHX source asset");
  }
  const encoded = PAYLOAD_PARTS.join("");
  const binary = atob(encoded);
  const compressed = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) compressed[index] = binary.charCodeAt(index);
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const payload = await new Response(stream).json();
  if (
    payload.schemaVersion !== 2
    || payload.archiveSha256 !== EXACT_KPHX_A1_PROFILE.archiveSha256
    || payload.bglSha256 !== EXACT_KPHX_A1_PROFILE.airportBglSha256
    || payload.projectedMeshes?.length !== EXACT_KPHX_A1_PROFILE.projectedMeshCount
    || payload.paintedLines?.length !== EXACT_KPHX_A1_PROFILE.paintedLineCount
  ) {
    throw new Error("The exact KPHX A1 source payload failed its identity/count contract");
  }
  return payload;
}

function sourceUv(mesh, x, z) {
  const scale = Math.abs(mesh.t) > 0.0001 ? mesh.t : 25;
  const angle = Number.isFinite(mesh.h) ? mesh.h : 0;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [(x * cosine + z * sine) / scale, (-x * sine + z * cosine) / scale];
}

function buildProjectedMeshes(THREE, payload) {
  const root = new THREE.Group();
  root.name = "KPHX_A1_ExactProjectedMeshes";
  const groups = new Map();

  payload.projectedMeshes.forEach((source, sourceIndex) => {
    const key = JSON.stringify([source.g, source.c, source.o, source.p]);
    if (!groups.has(key)) {
      groups.set(key, { source, positions: [], normals: [], uvs: [], indices: [], sourceIndices: [] });
    }
    const target = groups.get(key);
    const base = target.positions.length / 3;
    const elevated = source.p > 0 ? 0.072 : 0.052;
    for (const [x, z] of source.v) {
      target.positions.push(x, elevated + sourceIndex * 0.00001, z);
      target.normals.push(0, 1, 0);
      target.uvs.push(...sourceUv(source, x, z));
    }
    for (const index of source.i) target.indices.push(base + index);
    target.sourceIndices.push(sourceIndex);
  });

  let renderOrder = 100;
  for (const target of groups.values()) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(target.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(target.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(target.uvs, 2));
    geometry.setIndex(target.indices);
    geometry.computeBoundingSphere();

    const [red, green, blue, alpha] = target.source.c;
    const opacity = Math.min(1, Math.max(0, target.source.o / 255)) * Math.min(1, Math.max(0, alpha / 255));
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(red / 255, green / 255, blue / 255),
      transparent: opacity < 0.999,
      opacity,
      roughness: 0.94,
      metalness: 0,
      depthWrite: opacity >= 0.999,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    material.name = `unmlobo projected material ${target.source.g}`;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `KPHX_A1_ExactProjected_${target.source.g}_${renderOrder}`;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.renderOrder = renderOrder++;
    mesh.userData.sourceIndices = target.sourceIndices;
    mesh.userData.sourceGuid = target.source.g;
    mesh.userData.sourcePriority = target.source.p;
    root.add(mesh);
  }
  root.userData.sourceMeshRecords = payload.projectedMeshes.length;
  root.userData.renderMeshCount = root.children.length;
  return root;
}

function lineStyle(type) {
  const baseType = type >= LIGHTED_OFFSET ? type - LIGHTED_OFFSET : type;
  const lighted = type >= LIGHTED_OFFSET;
  if (baseType === 13) return { color: 0xf4f2e9, width: 0.76, dashed: false, lighted };
  if (baseType === 14) return { color: 0xc72329, width: 0.76, dashed: false, lighted };
  if (baseType === 15) return { color: 0xc72329, width: 0.20, dashed: false, lighted };
  if (baseType === 9 || baseType === 10 || baseType === 11) {
    return { color: 0xf4f2e9, width: baseType === 9 ? 0.16 : 0.20, dashed: baseType === 9 || baseType === 11, lighted };
  }
  if (baseType === 12) return { color: 0xf3c400, width: 0.76, dashed: false, lighted };
  if (baseType === 7) return { color: 0xf3c400, width: 0.20, dashed: true, lighted };
  if (baseType === 3 || baseType === 4 || baseType === 5) return { color: 0xf3c400, width: 0.38, dashed: false, lighted };
  return { color: 0xf3c400, width: 0.20, dashed: false, lighted };
}

function appendStrip(positions, indices, a, b, width, y) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.01) return;
  const nx = -dz / length * width / 2;
  const nz = dx / length * width / 2;
  const base = positions.length / 3;
  positions.push(
    a[0] + nx, y, a[1] + nz,
    b[0] + nx, y, b[1] + nz,
    b[0] - nx, y, b[1] - nz,
    a[0] - nx, y, a[1] - nz,
  );
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function appendDashedSegment(positions, indices, a, b, width, y, dash = 3, gap = 2.4) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.01) return;
  const ux = dx / length;
  const uz = dz / length;
  for (let distance = 0; distance < length; distance += dash + gap) {
    const end = Math.min(length, distance + dash);
    appendStrip(
      positions,
      indices,
      [a[0] + ux * distance, a[1] + uz * distance],
      [a[0] + ux * end, a[1] + uz * end],
      width,
      y,
    );
  }
}

function buildPaintedLines(THREE, payload) {
  const root = new THREE.Group();
  root.name = "KPHX_A1_ExactPaintedLines";
  const groups = new Map();

  payload.paintedLines.forEach((source, lineIndex) => {
    const style = lineStyle(source.k);
    const key = JSON.stringify(style);
    if (!groups.has(key)) groups.set(key, { style, positions: [], indices: [], lineCount: 0 });
    const target = groups.get(key);
    const y = EXACT_KPHX_A1_PROFILE.paintedLineBaseHeightMeters + lineIndex * 0.0000005;
    for (let index = 1; index < source.v.length; index += 1) {
      const a = source.v[index - 1];
      const b = source.v[index];
      if (style.dashed) appendDashedSegment(target.positions, target.indices, a, b, style.width, y);
      else appendStrip(target.positions, target.indices, a, b, style.width, y);
    }
    target.lineCount += 1;
  });

  let renderOrder = 300;
  for (const { style, positions, indices, lineCount } of groups.values()) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({
      color: style.color,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: !style.lighted,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `KPHX_A1_ExactPaintedLineType_${renderOrder}`;
    mesh.renderOrder = renderOrder++;
    mesh.userData.sourceLineCount = lineCount;
    mesh.userData.pavementOffsetMeters = EXACT_KPHX_A1_PROFILE.paintedLineBaseHeightMeters;
    root.add(mesh);
  }
  root.userData.sourceLineRecords = payload.paintedLines.length;
  root.userData.renderMeshCount = root.children.length;
  root.userData.paintedLineBaseHeightMeters = EXACT_KPHX_A1_PROFILE.paintedLineBaseHeightMeters;
  root.userData.contactMode = "pavement-coincident-decals";
  return root;
}

export async function installExactKphxA1(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  environment.userData.exactA1Source = "loading-unmlobo-kphx-v181";
  const payload = await decodePayload();
  const root = new THREE.Group();
  root.name = "KPHX_A1_ExactSuppliedSource";
  root.add(buildProjectedMeshes(THREE, payload));
  root.add(buildPaintedLines(THREE, payload));
  root.userData.source = EXACT_KPHX_A1_PROFILE.source;
  root.userData.archiveSha256 = EXACT_KPHX_A1_PROFILE.archiveSha256;
  root.userData.detailLevel = EXACT_KPHX_A1_PROFILE.detailLevel;
  root.userData.projectedMeshCount = payload.projectedMeshes.length;
  root.userData.paintedLineCount = payload.paintedLines.length;
  root.userData.paintedLineBaseHeightMeters = EXACT_KPHX_A1_PROFILE.paintedLineBaseHeightMeters;
  root.userData.markingContactMode = "pavement-coincident-decals";
  root.userData.anchor = payload.anchor;
  root.userData.radiusMeters = payload.selection.radiusMeters;
  environment.add(root);
  environment.userData.exactA1Source = "unmlobo-kphx-v181-exact-a1";
  environment.userData.exactA1DetailLevel = EXACT_KPHX_A1_PROFILE.detailLevel;
  environment.userData.exactA1ProjectedMeshCount = payload.projectedMeshes.length;
  environment.userData.exactA1PaintedLineCount = payload.paintedLines.length;
  environment.userData.exactA1PaintedLineBaseHeightMeters = EXACT_KPHX_A1_PROFILE.paintedLineBaseHeightMeters;
  environment.userData.exactA1MarkingContactMode = "pavement-coincident-decals";
  environment.userData.exactA1ArchiveSha256 = EXACT_KPHX_A1_PROFILE.archiveSha256;
  environment.userData.exactA1Root = root;
  return root;
}