import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

const OUT = path.resolve('user-repair-assets');
const JETWAY = path.resolve('public/models/airport-jetway/Airport_Jetway.glb');
const PLANE = path.resolve('public/models/crj700-user.glb');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'jetway', 'pieces'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'jetway', 'nodes'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'plane'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'airport'), { recursive: true });

const NUM_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

function safeName(value, fallback = 'unnamed') {
  const cleaned = String(value || fallback).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function parseGlb(file) {
  const bytes = fs.readFileSync(file);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  if (view.getUint32(4, true) !== 2) throw new Error(`${file}: only GLB v2 is supported`);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    if (type === 0x4e4f534a) json = JSON.parse(Buffer.from(bytes.subarray(start, end)).toString('utf8').replace(/\u0000+$/g, '').trim());
    if (type === 0x004e4942) bin = bytes.subarray(start, end);
    offset = end;
  }
  if (!json || !bin) throw new Error(`${file}: missing JSON or BIN chunk`);
  return { json, bin };
}

function componentAt(dataView, byteOffset, componentType) {
  switch (componentType) {
    case 5120: return dataView.getInt8(byteOffset);
    case 5121: return dataView.getUint8(byteOffset);
    case 5122: return dataView.getInt16(byteOffset, true);
    case 5123: return dataView.getUint16(byteOffset, true);
    case 5125: return dataView.getUint32(byteOffset, true);
    case 5126: return dataView.getFloat32(byteOffset, true);
    default: throw new Error(`Unsupported GLTF component type ${componentType}`);
  }
}

function normalizeComponent(value, componentType) {
  switch (componentType) {
    case 5120: return Math.max(value / 127, -1);
    case 5121: return value / 255;
    case 5122: return Math.max(value / 32767, -1);
    case 5123: return value / 65535;
    case 5125: return value / 4294967295;
    default: return value;
  }
}

function readAccessor(doc, bin, accessorIndex) {
  const accessor = doc.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  if (accessor.sparse) throw new Error(`Sparse accessor ${accessorIndex} is not supported by this export helper`);
  const bufferView = doc.bufferViews?.[accessor.bufferView];
  if (!bufferView) throw new Error(`Accessor ${accessorIndex} has no bufferView`);
  if ((bufferView.buffer ?? 0) !== 0) throw new Error(`Accessor ${accessorIndex} uses an external buffer`);
  const components = NUM_COMPONENTS[accessor.type];
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  if (!components || !componentBytes) throw new Error(`Accessor ${accessorIndex} has unsupported type`);
  const stride = bufferView.byteStride || componentBytes * components;
  const base = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const values = new Array(accessor.count * components);
  for (let i = 0; i < accessor.count; i += 1) {
    const row = base + i * stride;
    for (let c = 0; c < components; c += 1) {
      let value = componentAt(data, row + c * componentBytes, accessor.componentType);
      if (accessor.normalized) value = normalizeComponent(value, accessor.componentType);
      values[i * components + c] = value;
    }
  }
  return { values, count: accessor.count, components, accessor };
}

function nodeLocalMatrix(node) {
  const matrix = new THREE.Matrix4();
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return matrix.fromArray(node.matrix);
  const position = new THREE.Vector3(...(node.translation || [0, 0, 0]));
  const rotation = new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1]));
  const scale = new THREE.Vector3(...(node.scale || [1, 1, 1]));
  return matrix.compose(position, rotation, scale);
}

function trianglesFromPrimitive(primitive, vertexCount, doc, bin) {
  let source;
  if (primitive.indices != null) source = readAccessor(doc, bin, primitive.indices).values;
  else source = Array.from({ length: vertexCount }, (_, i) => i);
  const mode = primitive.mode ?? 4;
  const faces = [];
  if (mode === 4) {
    for (let i = 0; i + 2 < source.length; i += 3) faces.push([source[i], source[i + 1], source[i + 2]]);
  } else if (mode === 5) {
    for (let i = 0; i + 2 < source.length; i += 1) {
      const tri = i % 2 === 0 ? [source[i], source[i + 1], source[i + 2]] : [source[i + 1], source[i], source[i + 2]];
      if (tri[0] !== tri[1] && tri[1] !== tri[2] && tri[0] !== tri[2]) faces.push(tri);
    }
  } else if (mode === 6) {
    for (let i = 1; i + 1 < source.length; i += 1) faces.push([source[0], source[i], source[i + 1]]);
  }
  return faces;
}

function extractMeshRecords(file) {
  const { json: doc, bin } = parseGlb(file);
  const records = [];
  const sceneIndex = doc.scene ?? 0;
  const roots = doc.scenes?.[sceneIndex]?.nodes || [];
  const visited = new Set();

  function visit(nodeIndex, parentMatrix, ancestry) {
    const node = doc.nodes?.[nodeIndex] || {};
    const local = nodeLocalMatrix(node);
    const world = parentMatrix.clone().multiply(local);
    const nodeName = node.name || `node_${nodeIndex}`;
    const pathNames = [...ancestry, nodeName];
    visited.add(nodeIndex);
    if (node.mesh != null) {
      const mesh = doc.meshes?.[node.mesh] || {};
      const meshName = mesh.name || `mesh_${node.mesh}`;
      (mesh.primitives || []).forEach((primitive, primitiveIndex) => {
        const positionIndex = primitive.attributes?.POSITION;
        if (positionIndex == null) return;
        const position = readAccessor(doc, bin, positionIndex);
        if (position.components < 3) return;
        const positions = new Array(position.count * 3);
        const p = new THREE.Vector3();
        for (let i = 0; i < position.count; i += 1) {
          p.set(position.values[i * position.components], position.values[i * position.components + 1], position.values[i * position.components + 2]).applyMatrix4(world);
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
        }
        const faces = trianglesFromPrimitive(primitive, position.count, doc, bin);
        if (!faces.length) return;
        records.push({
          nodeIndex,
          meshIndex: node.mesh,
          primitiveIndex,
          nodeName,
          meshName,
          path: pathNames.join('/'),
          positions,
          faces,
        });
      });
    }
    for (const child of node.children || []) visit(child, world, pathNames);
  }

  for (const root of roots) visit(root, new THREE.Matrix4().identity(), []);
  // Include orphan nodes as a safety net; most authored GLBs should not need this.
  (doc.nodes || []).forEach((_, index) => {
    if (!visited.has(index)) visit(index, new THREE.Matrix4().identity(), ['ORPHAN']);
  });
  return { doc, records };
}

function objText(records, title) {
  const lines = [`# RampReady user-repair OBJ export`, `# ${title}`, '# Units: meters; Y-up; source model transform preserved'];
  let offset = 1;
  records.forEach((record, recordIndex) => {
    lines.push(`o ${safeName(record.nodeName, `part_${recordIndex}`)}`);
    lines.push(`g ${safeName(record.meshName, `mesh_${recordIndex}`)}`);
    for (let i = 0; i < record.positions.length; i += 3) {
      lines.push(`v ${record.positions[i].toFixed(7)} ${record.positions[i + 1].toFixed(7)} ${record.positions[i + 2].toFixed(7)}`);
    }
    for (const face of record.faces) lines.push(`f ${face[0] + offset} ${face[1] + offset} ${face[2] + offset}`);
    offset += record.positions.length / 3;
  });
  return `${lines.join('\n')}\n`;
}

function classify(record) {
  const leaf = `${record.nodeName} ${record.meshName}`.toLowerCase();
  const all = `${leaf} ${record.path}`.toLowerCase();
  if (/(service.?stair|stair|steps)/.test(leaf)) return '07_service_stair';
  if (/(bogie|wheel|tire|tyre|axle|truck|undercarriage|support|strut|column)/.test(leaf)) return '06_bogie_wheels_supports';
  if (/(cab|hood)/.test(all)) return '05_cab';
  if (/rotunda/.test(all)) return '01_rotunda';
  if (/(tunnel[_ .-]*a\b|tunnela)/.test(all)) return '02_tunnel_a';
  if (/(tunnel[_ .-]*b\b|tunnelb)/.test(all)) return '03_tunnel_b';
  if (/(tunnel[_ .-]*c\b|tunnelc)/.test(all)) return '04_tunnel_c';
  return '08_other_hardware';
}

function bounds(records) {
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (const r of records) for (let i = 0; i < r.positions.length; i += 3) box.expandByPoint(p.set(r.positions[i], r.positions[i + 1], r.positions[i + 2]));
  return box.isEmpty() ? null : { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray() };
}

function exportJetway() {
  const { doc, records } = extractMeshRecords(JETWAY);
  const root = path.join(OUT, 'jetway');
  fs.writeFileSync(path.join(root, 'Airport_Jetway_complete.obj'), objText(records, 'Complete supplied Airport_Jetway.glb'));
  fs.copyFileSync(JETWAY, path.join(root, 'Airport_Jetway_original.glb'));

  const groups = new Map();
  for (const record of records) {
    const key = classify(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  for (const [key, parts] of [...groups.entries()].sort()) {
    fs.writeFileSync(path.join(root, 'pieces', `${key}.obj`), objText(parts, `Jetway logical piece ${key}`));
  }

  const byNode = new Map();
  for (const record of records) {
    const key = `${String(record.nodeIndex).padStart(3, '0')}_${safeName(record.nodeName)}`;
    if (!byNode.has(key)) byNode.set(key, []);
    byNode.get(key).push(record);
  }
  for (const [key, parts] of byNode) fs.writeFileSync(path.join(root, 'nodes', `${key}.obj`), objText(parts, `Original GLB node ${key}`));

  const manifest = {
    source: 'public/models/airport-jetway/Airport_Jetway.glb',
    asset: doc.asset,
    logicalPieces: Object.fromEntries([...groups.entries()].sort().map(([key, parts]) => [key, { primitiveCount: parts.length, boundsMeters: bounds(parts), sourcePaths: [...new Set(parts.map((p) => p.path))] }])),
    originalNodeExports: [...byNode.keys()].sort(),
    completeBoundsMeters: bounds(records),
    primitiveCount: records.length,
  };
  fs.writeFileSync(path.join(root, 'jetway_manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

function exportPlane() {
  const { doc, records } = extractMeshRecords(PLANE);
  const root = path.join(OUT, 'plane');
  fs.writeFileSync(path.join(root, 'CRJ700.obj'), objText(records, 'CRJ700 user aircraft'));
  fs.copyFileSync(PLANE, path.join(root, 'CRJ700_original.glb'));
  const manifest = { source: 'public/models/crj700-user.glb', asset: doc.asset, primitiveCount: records.length, boundsMeters: bounds(records) };
  fs.writeFileSync(path.join(root, 'plane_manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

const jetwayManifest = exportJetway();
const planeManifest = exportPlane();
fs.writeFileSync(path.join(OUT, 'README.txt'), `RampReady / KPHX USER REPAIR ASSET PACKAGE\n\nCoordinates\n-----------\nOBJ exports use meters and Y-up. Jetway and CRJ source-model transforms are preserved; no RampReady runtime grounding, stretching, Cab fitting, or scene-placement corrections are baked into these two exports.\n\nJetway\n------\njetway/Airport_Jetway_complete.obj is the complete exact supplied jetway.\njetway/pieces/ contains logical repair groups (Rotunda, Tunnel A/B/C, Cab, bogie/supports, service stair, and unmatched hardware).\njetway/nodes/ contains an OBJ for every original named GLB mesh node so nothing depends on the logical classifier.\njetway/Airport_Jetway_original.glb is included unchanged.\n\nPlane\n-----\nplane/CRJ700.obj is the user CRJ700 source model.\nplane/CRJ700_original.glb is included unchanged.\n\nAirport\n-------\nThe airport OBJ is generated separately from the actual rendered Terminal 4 environment by the export workflow and is placed in airport/. Jetways, aircraft and tugs are filtered from that airport export so you can position them yourself.\n\nGenerated logical jetway groups: ${Object.keys(jetwayManifest.logicalPieces).join(', ')}\nCRJ primitive count: ${planeManifest.primitiveCount}\n`);
console.log(`Exported ${jetwayManifest.primitiveCount} jetway primitives and ${planeManifest.primitiveCount} aircraft primitives to ${OUT}`);
