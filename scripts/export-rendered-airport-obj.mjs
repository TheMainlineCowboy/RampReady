import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = path.resolve('user-repair-assets/airport');
fs.mkdirSync(outDir, { recursive: true });
const url = process.env.RAMPREADY_EXPORT_URL || 'http://127.0.0.1:4173/?inspectionPreset=a1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (msg) => console.log(`[browser:${msg.type()}] ${msg.text()}`));
page.on('pageerror', (error) => console.log(`[browser:error] ${error.message}`));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => Boolean(window.__rampReadyUserRepairExport?.environment), null, { timeout: 120000 });

// The terminal visual attaches asynchronously. For this fallback export we do not
// require jetway readiness: wait until the building scene itself has materially
// populated, then allow a short settle period for late terminal detail groups.
await page.waitForFunction(() => {
  const env = window.__rampReadyUserRepairExport?.environment;
  if (!env) return false;
  let meshes = 0;
  env.traverse?.((object) => { if (object?.isMesh || object?.isInstancedMesh) meshes += 1; });
  return meshes >= 40;
}, null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(12000);

const result = await page.evaluate(() => {
  const env = window.__rampReadyUserRepairExport.environment;
  env.updateMatrixWorld(true);

  const rejectPattern = /(airport[_ -]?jetway|jetway|rotunda|tunnel[_ -]?[abc]|\bcab\b|bogie|service[_ -]?stair|visible[_ -]?support|support[_ -]?sleeve|terminal[_ -]?connector|fixed[_ -]?corridor|fixed[_ -]?walkway|vestibule)/i;
  const includeObject = (object) => {
    const names = [];
    let cursor = object;
    while (cursor && cursor !== env.parent) {
      names.push(cursor.name || '');
      cursor = cursor.parent;
      if (cursor === env.parent) break;
    }
    let metadata = '';
    try { metadata = JSON.stringify(object.userData || {}); } catch { metadata = ''; }
    return !rejectPattern.test(`${names.join(' ')} ${metadata}`);
  };

  const num = (v) => Number(v).toFixed(7);
  const full = ['# RampReady KPHX / Terminal 4 rendered environment', '# Jetways, aircraft and tug geometry filtered out', '# Units: meters; Y-up; coordinates are RampReady scene/world coordinates'];
  const a1 = ['# RampReady KPHX A1/A3 local area', '# Jetways, aircraft and tug geometry filtered out', '# Units: meters; Y-up; coordinates are RampReady scene/world coordinates'];
  let fullOffset = 1;
  let a1Offset = 1;
  let exportedMeshes = 0;
  let excludedMeshes = 0;
  let fullTriangles = 0;
  let localTriangles = 0;
  const manifest = [];

  const writeGeometry = (lines, geometry, matrix, label, offsetStart, crop) => {
    const position = geometry?.attributes?.position;
    if (!position || position.itemSize < 3) return { offset: offsetStart, triangles: 0, vertices: 0 };
    const index = geometry.index;
    const e = matrix.elements;
    const transform = (x, y, z) => {
      const denominator = e[3] * x + e[7] * y + e[11] * z + e[15];
      const w = denominator ? 1 / denominator : 1;
      return [
        (e[0] * x + e[4] * y + e[8] * z + e[12]) * w,
        (e[1] * x + e[5] * y + e[9] * z + e[13]) * w,
        (e[2] * x + e[6] * y + e[10] * z + e[14]) * w,
      ];
    };
    const transformed = new Array(position.count);
    for (let i = 0; i < position.count; i += 1) transformed[i] = transform(position.getX(i), position.getY(i), position.getZ(i));
    const source = index ? Array.from(index.array) : Array.from({ length: position.count }, (_, i) => i);
    const acceptedFaces = [];
    for (let i = 0; i + 2 < source.length; i += 3) {
      const face = [source[i], source[i + 1], source[i + 2]];
      if (crop) {
        const p0 = transformed[face[0]], p1 = transformed[face[1]], p2 = transformed[face[2]];
        const cx = (p0[0] + p1[0] + p2[0]) / 3;
        const cz = (p0[2] + p1[2] + p2[2]) / 3;
        if (cx < -125 || cx > 135 || cz < -145 || cz > 135) continue;
      }
      acceptedFaces.push(face);
    }
    if (!acceptedFaces.length) return { offset: offsetStart, triangles: 0, vertices: 0 };
    lines.push(`o ${String(label || 'mesh').replace(/[^A-Za-z0-9._-]+/g, '_')}`);
    transformed.forEach((p) => lines.push(`v ${num(p[0])} ${num(p[1])} ${num(p[2])}`));
    acceptedFaces.forEach((f) => lines.push(`f ${f[0] + offsetStart} ${f[1] + offsetStart} ${f[2] + offsetStart}`));
    return { offset: offsetStart + transformed.length, triangles: acceptedFaces.length, vertices: transformed.length };
  };

  const matrixForInstance = (object, instanceIndex) => {
    if (!object.isInstancedMesh) return object.matrixWorld;
    const instance = object.matrixWorld.clone();
    const local = object.matrixWorld.clone().identity();
    object.getMatrixAt(instanceIndex, local);
    return instance.multiply(local);
  };

  env.traverse((object) => {
    if (!(object?.isMesh || object?.isInstancedMesh) || !object.geometry) return;
    if (!includeObject(object)) { excludedMeshes += 1; return; }
    const count = object.isInstancedMesh ? object.count : 1;
    for (let instanceIndex = 0; instanceIndex < count; instanceIndex += 1) {
      const label = `${object.name || object.geometry.name || 'mesh'}${object.isInstancedMesh ? `_instance_${instanceIndex}` : ''}`;
      const matrix = matrixForInstance(object, instanceIndex);
      const fullResult = writeGeometry(full, object.geometry, matrix, label, fullOffset, false);
      fullOffset = fullResult.offset;
      fullTriangles += fullResult.triangles;
      const localResult = writeGeometry(a1, object.geometry, matrix, label, a1Offset, true);
      a1Offset = localResult.offset;
      localTriangles += localResult.triangles;
      if (fullResult.triangles) exportedMeshes += 1;
      manifest.push({ name: object.name || '', geometryName: object.geometry.name || '', instanceIndex, fullTriangles: fullResult.triangles, a1AreaTriangles: localResult.triangles });
    }
  });

  return {
    fullObj: `${full.join('\n')}\n`,
    localObj: `${a1.join('\n')}\n`,
    manifest: { exportedMeshes, excludedMeshes, fullTriangles, localTriangles, cropWorldXZ: { minX: -125, maxX: 135, minZ: -145, maxZ: 135 }, objects: manifest },
  };
});

fs.writeFileSync(path.join(outDir, 'KPHX_Terminal4_Setup.obj'), result.fullObj);
fs.writeFileSync(path.join(outDir, 'KPHX_A1_A3_Area.obj'), result.localObj);
fs.writeFileSync(path.join(outDir, 'airport_export_manifest.json'), JSON.stringify(result.manifest, null, 2));
console.log(`Airport OBJ export: ${result.manifest.fullTriangles} full triangles; ${result.manifest.localTriangles} A1/A3-area triangles.`);
await browser.close();
