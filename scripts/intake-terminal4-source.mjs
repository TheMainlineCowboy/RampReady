import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const usage = "Usage: node scripts/intake-terminal4-source.mjs <SkyHarborPhx-root> [output-directory]";
const sourceArg = process.argv[2];
if (!sourceArg) throw new Error(usage);

const sourceRoot = path.resolve(sourceArg);
const outputRoot = path.resolve(process.argv[3] ?? "artifacts/terminal4-source-intake");
const publicRoot = path.resolve(fileURLToPath(new URL("../public", import.meta.url)));

const normalize = (value) => value.split(path.sep).join("/");
const isWithin = (candidate, parent) => candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
if (isWithin(sourceRoot, publicRoot) || isWithin(outputRoot, publicRoot)) {
  throw new Error("Terminal 4 legacy sources and intake reports must remain outside public runtime assets");
}

const requiredFiles = ["scenery/term4.BGL", "scenery/KPHX_ADEX.BGL"];
const allowedExtensions = new Set([".bgl", ".bmp", ".dds"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function classify(relativePath) {
  const lower = relativePath.toLowerCase();
  if (lower === "scenery/term4.bgl") return "terminal4-primary";
  if (lower === "scenery/kphx_adex.bgl") return "airport-layout-authority";
  if (lower.endsWith(".bgl") && lower.includes("term4")) return "terminal4-support";
  if (lower.endsWith(".bgl") && lower.includes("jetway")) return "jetway-support";
  if (lower.endsWith(".bgl") && lower.includes("gate")) return "gate-support";
  if (lower.endsWith(".bmp") || lower.endsWith(".dds")) return "texture-or-lightmap";
  if (lower.endsWith(".bgl")) return "other-scenery";
  return "ignored";
}

async function inspectFile(absolutePath) {
  const relativePath = normalize(path.relative(sourceRoot, absolutePath));
  const extension = path.extname(absolutePath).toLowerCase();
  if (!allowedExtensions.has(extension)) return null;
  const bytes = await readFile(absolutePath);
  const metadata = await stat(absolutePath);
  return {
    path: relativePath,
    role: classify(relativePath),
    sizeBytes: metadata.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    headerHex: bytes.subarray(0, Math.min(16, bytes.length)).toString("hex"),
  };
}

const allFiles = await walk(sourceRoot);
const inspected = (await Promise.all(allFiles.map(inspectFile))).filter(Boolean).sort((a, b) => a.path.localeCompare(b.path));
const byPath = new Map(inspected.map((file) => [file.path.toLowerCase(), file]));
const missingRequired = requiredFiles.filter((required) => !byPath.has(required.toLowerCase()));

const report = {
  schemaVersion: 1,
  sourceRepository: "TheMainlineCowboy/SkyHarborPhx",
  sourceRoot,
  generatedAt: new Date().toISOString(),
  corridor: { startGate: "B15", endGate: "A1" },
  runtimeImportAllowed: false,
  finalCoordinatesMayBeEyeballed: false,
  requiredFiles,
  missingRequired,
  counts: {
    totalInspected: inspected.length,
    bgl: inspected.filter((file) => file.path.toLowerCase().endsWith(".bgl")).length,
    textures: inspected.filter((file) => /\.(bmp|dds)$/i.test(file.path)).length,
    terminal4Candidates: inspected.filter((file) => file.role.startsWith("terminal4") || file.role.includes("gate") || file.role.includes("jetway") || file.role === "airport-layout-authority").length,
  },
  files: inspected,
  extractionState: missingRequired.length === 0 ? "source-inventory-ready" : "blocked-missing-required-source",
  nextRequiredStage: "decode ADEX parking and object-placement records before assigning any gate coordinates",
};

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "terminal4-source-intake-report.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(
  path.join(outputRoot, "SHA256SUMS"),
  `${inspected.map((file) => `${file.sha256}  ${file.path}`).join("\n")}${inspected.length ? "\n" : ""}`,
);

if (missingRequired.length) {
  throw new Error(`Terminal 4 intake blocked; missing required source files: ${missingRequired.join(", ")}`);
}

console.log(`Terminal 4 source intake passed: ${inspected.length} legacy assets inventoried.`);
console.log(`Report: ${path.join(outputRoot, "terminal4-source-intake-report.json")}`);
