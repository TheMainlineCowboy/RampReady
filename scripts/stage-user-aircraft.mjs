import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  CRJ700_ASSET_CONTRACT_VERSION,
  validateAircraftAssetMetadata,
} from "../src/components/aircraft/aircraftAssetContract.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceArg = process.argv[2];
const dimensionsArg = process.argv[3];

if (!sourceArg) {
  console.error("Usage: npm run stage:aircraft -- /absolute/or/relative/model.glb '32.5,23.64'");
  process.exit(2);
}

const sourcePath = path.resolve(process.cwd(), sourceArg);
const destinationDir = path.join(repoRoot, "public", "models");
const destinationPath = path.join(destinationDir, "crj700-user.glb");
const metadataPath = path.join(destinationDir, "crj700-user.asset.json");
const tempPath = `${destinationPath}.tmp`;

const [length, wingspan] = String(dimensionsArg || "32.5,23.64")
  .split(",")
  .map((value) => Number(value.trim()));

const sourceStats = await stat(sourcePath);
if (!sourceStats.isFile() || sourceStats.size < 20) throw new Error("Aircraft source must be a non-empty GLB file");

const bytes = await readFile(sourcePath);
if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Aircraft source is not a binary glTF/GLB file");
const version = bytes.readUInt32LE(4);
const declaredLength = bytes.readUInt32LE(8);
if (version !== 2) throw new Error(`Unsupported GLB version ${version}; expected version 2`);
if (declaredLength !== bytes.byteLength) throw new Error(`GLB length header ${declaredLength} does not match file length ${bytes.byteLength}`);

const sha256 = createHash("sha256").update(bytes).digest("hex");
const metadata = {
  contractVersion: CRJ700_ASSET_CONTRACT_VERSION,
  aircraftType: "CRJ700",
  sourceFilename: path.basename(sourcePath),
  sha256,
  byteLength: bytes.byteLength,
  dimensionsMeters: { length, wingspan },
  orientation: { up: "+Y", forward: "-Z" },
  noseGearCaptureOrigin: [0, 0, 0],
  preserveMaterials: true,
  stagedAt: new Date().toISOString(),
};

const validation = validateAircraftAssetMetadata(metadata);
if (!validation.valid) throw new Error(`Aircraft metadata rejected: ${validation.failures.join("; ")}`);

await mkdir(destinationDir, { recursive: true });
await copyFile(sourcePath, tempPath);
await rename(tempPath, destinationPath);
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

console.log(`Staged user-painted CRJ700: ${path.relative(repoRoot, destinationPath)}`);
console.log(`SHA-256: ${sha256}`);
console.log(`Dimensions: ${length.toFixed(2)} m x ${wingspan.toFixed(2)} m`);
console.log(`Metadata: ${path.relative(repoRoot, metadataPath)}`);
