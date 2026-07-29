import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const AIRPORT_SOURCE_COMMIT = "7ee8f9b4712f842706f00aa5a307e8861b601620";
const TERMINAL_SOURCE_COMMIT = "2e6642778c9c88eac6a82b21063763cc78be7cfe";
const AIRPORT_SOURCE_ROOT = `https://raw.githubusercontent.com/TheMainlineCowboy/SkyHarborPhx/${AIRPORT_SOURCE_COMMIT}`;
const TERMINAL_SOURCE_ROOT = `https://raw.githubusercontent.com/TheMainlineCowboy/SkyHarborPhx/${TERMINAL_SOURCE_COMMIT}`;
const outputPath = path.resolve(process.argv[2] ?? "reports/kphx-jetway-terminal-audit.json");
const workDir = path.resolve(".cache/kphx-jetway-terminal-audit");
const fallbackTextures = Object.freeze({
  "PARKRAMPS2.BMP": "parkramps.bmp",
  "PHX_TERM400_0.DDS": "bgate1.bmp",
  "PHX_TERM400_1.DDS": "bgate3.bmp",
  "PHXRAMPLIGHT.BMP": "supports2.bmp",
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function download(url) {
  const response = await fetch(url, { headers: { "User-Agent": "RampReady-KPHX-Source-Audit" } });
  if (!response.ok) throw new Error(`Source audit failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const lonDeg = (raw) => raw * (360 / (3 * 0x10000000)) - 180;
const latDeg = (raw) => 90 - raw * (180 / (2 * 0x10000000));
const angle16 = (raw) => raw * 360 / 0x10000;
const charFor = (value) => {
  if (value === 0) return " ";
  if (value >= 2 && value <= 11) return String.fromCharCode(48 + value - 2);
  if (value >= 12 && value <= 37) return String.fromCharCode(65 + value - 12);
  return "?";
};
const decodeIcao = (raw) => {
  let value = raw >>> 5;
  if (!value) return "";
  const chars = [];
  while (value > 37) {
    const next = value % 38;
    chars.unshift(charFor(next));
    value = Math.floor((value - next) / 38);
  }
  chars.unshift(charFor(value));
  return chars.join("").trim();
};
function formatGuid(bytes, offset) {
  const data1 = bytes.readUInt32LE(offset).toString(16).padStart(8, "0");
  const data2 = bytes.readUInt16LE(offset + 4).toString(16).padStart(4, "0");
  const data3 = bytes.readUInt16LE(offset + 6).toString(16).padStart(4, "0");
  const data4a = bytes.subarray(offset + 8, offset + 10).toString("hex");
  const data4b = bytes.subarray(offset + 10, offset + 16).toString("hex");
  return `{${data1}-${data2}-${data3}-${data4a}-${data4b}}`;
}

function decodeJetwayLibraryRecords(data) {
  const u16 = (offset) => data.readUInt16LE(offset);
  const u32 = (offset) => data.readUInt32LE(offset);
  const f32 = (offset) => data.readFloatLE(offset);
  if (data.length < 0x38 || u32(0) !== 0x19920201 || u32(4) !== 0x38) throw new Error("Jetway audit received a non-FSX BGL");
  const sectionCount = u32(0x14);
  let airportSection = null;
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = 0x38 + index * 20;
    if (u32(offset) !== 0x03) continue;
    const flags = u32(offset + 4);
    airportSection = {
      subsectionCount: u32(offset + 8),
      subsectionOffset: u32(offset + 12),
      subsectionSize: ((flags & 0x10000) | 0x40000) >>> 14,
    };
    break;
  }
  if (!airportSection) throw new Error("Jetway audit found no airport section");

  const jetways = [];
  const airportSubrecordCounts = {};
  for (let subIndex = 0; subIndex < airportSection.subsectionCount; subIndex += 1) {
    const subsection = airportSection.subsectionOffset + subIndex * airportSection.subsectionSize;
    if (subsection + airportSection.subsectionSize > data.length) break;
    const recordCount = u32(subsection + 4);
    const dataOffset = u32(subsection + 8);
    const dataEnd = Math.min(data.length, dataOffset + u32(subsection + 12));
    let cursor = dataOffset;
    for (let recordIndex = 0; recordIndex < Math.max(recordCount, 1) && cursor + 0x38 <= dataEnd; recordIndex += 1) {
      const id = u16(cursor);
      const size = u32(cursor + 2);
      if (id !== 0x003c || size < 0x38 || cursor + size > dataEnd) break;
      const icao = decodeIcao(u32(cursor + 0x28));
      if (icao === "KPHX") {
        let child = cursor + 0x38;
        const end = cursor + size;
        while (child + 6 <= end) {
          const childId = u16(child);
          const childSize = u32(child + 2);
          if (childSize < 6 || child + childSize > end) break;
          const key = `0x${childId.toString(16).padStart(4, "0")}`;
          airportSubrecordCounts[key] = (airportSubrecordCounts[key] ?? 0) + 1;
          if (childId === 0x003a || childId === 0x00de) {
            const parkingNumber = childSize >= 10 ? u16(child + 6) : null;
            const gateName = childSize >= 10 ? u16(child + 8) : null;
            let libraryOffset = null;
            for (let candidate = child + 10; candidate + 64 <= child + childSize; candidate += 2) {
              if (u16(candidate) === 0x000b && u16(candidate + 2) === 64) {
                libraryOffset = candidate;
                break;
              }
            }
            const record = {
              recordType: key,
              sourceByteOffset: child,
              sourceByteLength: childSize,
              parkingNumber,
              gateName,
              libraryObjectEmbedded: libraryOffset !== null,
            };
            if (libraryOffset !== null) {
              record.libraryObject = {
                sourceByteOffset: libraryOffset,
                longitude: lonDeg(u32(libraryOffset + 4)),
                latitude: latDeg(u32(libraryOffset + 8)),
                altitudeMeters: u32(libraryOffset + 12) / 1000,
                flags: u16(libraryOffset + 16),
                pitchDegrees: angle16(u16(libraryOffset + 18)),
                bankDegrees: angle16(u16(libraryOffset + 20)),
                headingDegrees: angle16(u16(libraryOffset + 22)),
                imageComplexity: u32(libraryOffset + 24),
                instanceGuid: formatGuid(data, libraryOffset + 28),
                modelGuid: formatGuid(data, libraryOffset + 44),
                scale: f32(libraryOffset + 60),
              };
            }
            jetways.push(record);
          }
          child += childSize;
        }
      }
      cursor += size;
    }
  }
  if (!jetways.length) throw new Error("Jetway audit decoded no KPHX jetway records");
  const modelGuidCounts = {};
  for (const jetway of jetways) {
    const guid = jetway.libraryObject?.modelGuid ?? "new-format-no-embedded-library-object";
    modelGuidCounts[guid] = (modelGuidCounts[guid] ?? 0) + 1;
  }
  return { jetways, modelGuidCounts, airportSubrecordCounts };
}

function accessorBounds(gltf, bin, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  const view = accessor && gltf.bufferViews?.[accessor.bufferView];
  if (!accessor || !view || accessor.componentType !== 5126 || accessor.type !== "VEC3") return null;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? 12;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < accessor.count; index += 1) {
    const offset = start + index * stride;
    if (offset + 12 > bin.length) break;
    for (let axis = 0; axis < 3; axis += 1) {
      const value = bin.readFloatLE(offset + axis * 4);
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return min.every(Number.isFinite) ? { min, max } : null;
}

await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });
await mkdir(path.dirname(outputPath), { recursive: true });

const [airportBgl, terminalBgl, extractor] = await Promise.all([
  download(`${AIRPORT_SOURCE_ROOT}/scenery/KPHX_ADEX.BGL`),
  download(`${TERMINAL_SOURCE_ROOT}/scenery/term4.BGL`),
  download(`${TERMINAL_SOURCE_ROOT}/scripts/extract-terminal4-mdlx.mjs`),
]);
const airportAudit = decodeJetwayLibraryRecords(airportBgl);

const terminalBglPath = path.join(workDir, "term4.BGL");
const extractorPath = path.join(workDir, "extract-terminal4-mdlx.mjs");
const terminalOutput = path.join(workDir, "terminal4");
await writeFile(terminalBglPath, terminalBgl);
await writeFile(extractorPath, extractor);
await mkdir(terminalOutput, { recursive: true });
const extraction = spawnSync(process.execPath, [extractorPath, terminalBglPath, terminalOutput], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 120_000,
});
if (extraction.error) throw extraction.error;
if (extraction.status !== 0) throw new Error(`Terminal primitive audit extractor failed (${extraction.status}): ${extraction.stderr || extraction.stdout}`);
const gltf = JSON.parse(await readFile(path.join(terminalOutput, "terminal4.gltf"), "utf8"));
const bin = await readFile(path.join(terminalOutput, "terminal4.bin"));
const primitives = (gltf.meshes?.[0]?.primitives ?? []).map((primitive, index) => {
  const material = gltf.materials?.[primitive.material];
  const requestedTexture = material?.extras?.diffuseTexture ?? null;
  return {
    primitiveIndex: index,
    materialIndex: primitive.material,
    materialName: material?.name ?? null,
    requestedTexture,
    fallbackTexture: requestedTexture ? fallbackTextures[requestedTexture] ?? null : null,
    usesFallbackTexture: Boolean(requestedTexture && fallbackTextures[requestedTexture]),
    bounds: accessorBounds(gltf, bin, primitive.attributes?.POSITION),
    vertexCount: gltf.accessors?.[primitive.attributes?.POSITION]?.count ?? null,
  };
});
const fallbackPrimitives = primitives.filter((primitive) => primitive.usesFallbackTexture);

const report = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  sources: {
    airport: { repository: "TheMainlineCowboy/SkyHarborPhx", commit: AIRPORT_SOURCE_COMMIT, path: "scenery/KPHX_ADEX.BGL", bytes: airportBgl.length, sha256: sha256(airportBgl) },
    terminal: { repository: "TheMainlineCowboy/SkyHarborPhx", commit: TERMINAL_SOURCE_COMMIT, path: "scenery/term4.BGL", bytes: terminalBgl.length, sha256: sha256(terminalBgl) },
  },
  jetways: {
    recordCount: airportAudit.jetways.length,
    embeddedLibraryObjectCount: airportAudit.jetways.filter((jetway) => jetway.libraryObjectEmbedded).length,
    modelGuidCounts: airportAudit.modelGuidCounts,
    records: airportAudit.jetways,
    airportSubrecordCounts: airportAudit.airportSubrecordCounts,
  },
  terminal: {
    primitiveCount: primitives.length,
    fallbackPrimitiveCount: fallbackPrimitives.length,
    fallbackTextureMap: fallbackTextures,
    fallbackPrimitives,
    primitives,
  },
  decisions: [
    "Do not retain procedural box-built jetways as simulator-quality geometry.",
    "Use the decoded library model GUID to identify or faithfully rebuild the intended simulator jetway family.",
    "Do not map missing PHX_TERM400 materials to unrelated BGATE facades.",
    "Mask or neutrally rematerialize only the audited fallback primitives until exact diffuse maps are recovered.",
  ],
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  jetwayRecords: report.jetways.recordCount,
  embeddedLibraryObjects: report.jetways.embeddedLibraryObjectCount,
  modelGuidCounts: report.jetways.modelGuidCounts,
  terminalPrimitives: report.terminal.primitiveCount,
  fallbackPrimitives: report.terminal.fallbackPrimitiveCount,
}, null, 2));
