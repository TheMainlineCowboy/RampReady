import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const OWNER = "TheMainlineCowboy";
const SOURCE_REPO = "SkyHarborPhx";
const SOURCE_COMMIT = "2e6642778c9c88eac6a82b21063763cc78be7cfe";
const OUTPUT_PATH = "reports/phx-source-model-audit.json";
const apiHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "RampReady-PHX-source-model-audit",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: apiHeaders });
  if (!response.ok) throw new Error(`PHX source audit request failed ${response.status}: ${url}`);
  return response.json();
}

async function fetchBytes(path) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${OWNER}/${SOURCE_REPO}/${SOURCE_COMMIT}/${encodedPath}`;
  const response = await fetch(url, { headers: { "User-Agent": apiHeaders["User-Agent"] } });
  if (!response.ok) throw new Error(`PHX source file returned HTTP ${response.status}: ${path}`);
  return Buffer.from(await response.arrayBuffer());
}

const u32 = (buffer, offset) => buffer.readUInt32LE(offset);

function readCString(buffer, start, end) {
  let stop = start;
  while (stop < end && buffer[stop] !== 0) stop += 1;
  return buffer.toString("ascii", start, stop).trim();
}

function chunks(buffer, start, end, prefixBytes = 0) {
  const result = [];
  let offset = start + prefixBytes;
  while (offset + 8 <= end) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = u32(buffer, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (!/^[\x20-\x7e]{4}$/.test(id) || dataEnd > end) break;
    result.push({ id, offset, size, dataStart, dataEnd });
    offset = dataEnd + (size & 1);
  }
  return result;
}

function scanMdlx(buffer, sourcePath) {
  const models = [];
  let searchFrom = 0;
  while (searchFrom + 12 <= buffer.length) {
    const offset = buffer.indexOf("RIFF", searchFrom, "ascii");
    if (offset < 0 || offset + 12 > buffer.length) break;
    searchFrom = offset + 4;
    if (buffer.toString("ascii", offset + 8, offset + 12) !== "MDLX") continue;
    const riffSize = u32(buffer, offset + 4);
    const end = offset + 8 + riffSize;
    if (riffSize < 12 || end > buffer.length) continue;
    const mdl = buffer.subarray(offset, end);
    const top = chunks(mdl, 12, mdl.length);
    const nameChunk = top.find((entry) => entry.id === "MDLN");
    const mdld = top.find((entry) => entry.id === "MDLD");
    const name = nameChunk ? readCString(mdl, nameChunk.dataStart, nameChunk.dataEnd) : `unnamed-${models.length}`;
    const textures = [];
    let highestLod = null;
    let partCount = 0;
    if (mdld) {
      const sections = chunks(mdl, mdld.dataStart, mdld.dataEnd);
      const text = sections.find((entry) => entry.id === "TEXT");
      if (text) {
        for (let cursor = text.dataStart; cursor + 64 <= text.dataEnd; cursor += 64) {
          const texture = readCString(mdl, cursor, cursor + 64);
          if (texture) textures.push(texture);
        }
      }
      const lodt = sections.find((entry) => entry.id === "LODT");
      if (lodt) {
        for (const lode of chunks(mdl, lodt.dataStart, lodt.dataEnd)) {
          if (lode.id !== "LODE" || lode.size < 4) continue;
          const lod = mdl.readInt32LE(lode.dataStart);
          highestLod = highestLod === null ? lod : Math.max(highestLod, lod);
          partCount += chunks(mdl, lode.dataStart, lode.dataEnd, 4).filter((entry) => entry.id === "PART").length;
        }
      }
    }
    const searchText = `${sourcePath} ${name} ${textures.join(" ")}`.toLowerCase();
    const candidateTerms = ["jetway", "jet_way", "jet-way", "bridge", "gate", "walkway", "tunnel", "rotunda", "bellows"];
    const candidateMatches = candidateTerms.filter((term) => searchText.includes(term));
    models.push({
      sourcePath,
      offset,
      byteLength: mdl.length,
      sha256: createHash("sha256").update(mdl).digest("hex"),
      name,
      textures: [...new Set(textures)],
      highestLod,
      partCount,
      candidateMatches,
      likelyJetwayOrGateModel: candidateMatches.length > 0,
    });
    searchFrom = end;
  }
  return models;
}

function parseFallbackTextures(materializerSource) {
  const records = [];
  const expression = /"([^"]+)":\s*\{\s*sourcePath:\s*"([^"]+)",\s*fidelity:\s*"([^"]+)"\s*\}/g;
  let match;
  while ((match = expression.exec(materializerSource)) !== null) {
    records.push({ requestedTexture: match[1], suppliedTexture: match[2], fidelity: match[3] });
  }
  return records.filter((entry) => entry.fidelity !== "exact");
}

const treeUrl = `https://api.github.com/repos/${OWNER}/${SOURCE_REPO}/git/trees/${SOURCE_COMMIT}?recursive=1`;
const tree = await fetchJson(treeUrl);
if (tree.truncated) throw new Error("PHX source tree response was truncated");
const bglPaths = tree.tree
  .filter((entry) => entry.type === "blob" && /\.bgl$/i.test(entry.path))
  .map((entry) => entry.path)
  .sort((left, right) => left.localeCompare(right));
if (!bglPaths.length) throw new Error("PHX source repository contains no BGL files at the pinned commit");

const bglRecords = [];
const allModels = [];
for (const sourcePath of bglPaths) {
  const bytes = await fetchBytes(sourcePath);
  const models = scanMdlx(bytes, sourcePath);
  bglRecords.push({
    path: sourcePath,
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    embeddedMdlxCount: models.length,
    modelNames: models.map((model) => model.name),
  });
  allModels.push(...models);
}

const materializerSource = await readFile("scripts/materialize-phx-terminal4.mjs", "utf8");
const proceduralJetwaySource = await readFile("src/environment/sourcePlacedTerminal4Jetways.js", "utf8");
const fallbackTextures = parseFallbackTextures(materializerSource);
const jetwayCandidates = allModels.filter((model) => model.likelyJetwayOrGateModel);
const report = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  source: {
    repository: `${OWNER}/${SOURCE_REPO}`,
    commit: SOURCE_COMMIT,
    archiveUnderReview: "unmlobo-kphx1-8-1_Mu9aq.zip",
  },
  currentRuntimeDiagnosis: {
    terminalShellSource: "scenery/term4.BGL from the pinned SkyHarborPhx repository",
    placementSource: "unmlobo KPHX 1.8.1 airport records",
    jetwayGeometrySource: proceduralJetwaySource.includes("new THREE.BoxGeometry")
      ? "procedural Three.js geometry"
      : "unknown",
    usesProceduralJetwayGeometry: /BoxGeometry|CylinderGeometry/.test(proceduralJetwaySource),
    fallbackTerminalTextureCount: fallbackTextures.length,
    fallbackTerminalTextures: fallbackTextures,
    mixedSourceRuntime: true,
  },
  inventory: {
    bglCount: bglRecords.length,
    embeddedMdlxModelCount: allModels.length,
    likelyJetwayOrGateModelCount: jetwayCandidates.length,
    bglFiles: bglRecords,
    models: allModels,
    likelyJetwayOrGateModels: jetwayCandidates,
  },
  decision: jetwayCandidates.length
    ? "Extract and validate the matching supplied jetway/gate models before replacing the procedural runtime."
    : "No obvious supplied jetway model was found by source path, model name, or texture references; verify whether the airport references an external simulator library model before sourcing a replacement.",
  nextActions: [
    "Stop treating procedural jetway geometry as simulator-quality source geometry.",
    "Replace the mixed old-terminal/new-placement runtime with one consistent source package.",
    "Eliminate every terminal material fallback or explicitly mask unsupported source parts.",
    "After the terminal/jetways are source-correct, materialize full-field taxiways, runways, centerlines, hold-short markings, and signs from the airport records.",
  ],
};

await mkdir("reports", { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`PHX source-model audit complete: ${bglRecords.length} BGL files, ${allModels.length} embedded MDLX models, ${jetwayCandidates.length} likely jetway/gate candidates, ${fallbackTextures.length} terminal texture substitutions.`);
console.log(`Report: ${OUTPUT_PATH}`);
