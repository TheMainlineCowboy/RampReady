import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "rampready-terminal4-intake-"));
const sourceRoot = path.join(tempRoot, "SkyHarborPhx");
const outputRoot = path.join(tempRoot, "report");

const fail = (message) => {
  throw new Error(`Terminal 4 intake tooling verification failed: ${message}`);
};

try {
  await mkdir(path.join(sourceRoot, "scenery"), { recursive: true });
  await mkdir(path.join(sourceRoot, "texture"), { recursive: true });
  await writeFile(path.join(sourceRoot, "scenery", "term4.BGL"), Buffer.from("5445524d3442474c0001020304050607", "hex"));
  await writeFile(path.join(sourceRoot, "scenery", "KPHX_ADEX.BGL"), Buffer.from("4144455842474c000102030405060708", "hex"));
  await writeFile(path.join(sourceRoot, "scenery", "term4_jetways.BGL"), Buffer.from("4a455457415942474c00010203040506", "hex"));
  await writeFile(path.join(sourceRoot, "texture", "term4_day.DDS"), Buffer.from("444453200102030405060708090a0b0c", "hex"));
  await writeFile(path.join(sourceRoot, "README.txt"), "must be ignored\n");

  await execFileAsync(process.execPath, ["scripts/intake-terminal4-source.mjs", sourceRoot, outputRoot], { cwd: process.cwd() });

  const report = JSON.parse(await readFile(path.join(outputRoot, "terminal4-source-intake-report.json"), "utf8"));
  if (report.schemaVersion !== 1) fail("schema version changed");
  if (report.sourceRepository !== "TheMainlineCowboy/SkyHarborPhx") fail("source repository is not pinned");
  if (report.runtimeImportAllowed !== false) fail("legacy runtime import must remain blocked");
  if (report.finalCoordinatesMayBeEyeballed !== false) fail("gate coordinates may not be eyeballed");
  if (report.extractionState !== "source-inventory-ready") fail("valid fixture did not reach source-inventory-ready");
  if (report.missingRequired.length !== 0) fail("required fixture files were reported missing");
  if (report.counts.totalInspected !== 4 || report.counts.bgl !== 3 || report.counts.textures !== 1) fail("asset counts are incorrect");
  if (report.files.some((file) => file.path === "README.txt")) fail("non-legacy files must be ignored");
  if (!report.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))) fail("SHA-256 digest missing");
  if (!report.files.some((file) => file.path === "scenery/KPHX_ADEX.BGL" && file.role === "airport-layout-authority")) fail("ADEX authority classification missing");
  if (!report.files.some((file) => file.path === "scenery/term4_jetways.BGL" && file.role === "terminal4-support")) fail("Terminal 4 support classification missing");

  const sums = await readFile(path.join(outputRoot, "SHA256SUMS"), "utf8");
  if (!sums.includes("scenery/term4.BGL") || !sums.includes("texture/term4_day.DDS")) fail("checksum manifest incomplete");

  await rm(path.join(sourceRoot, "scenery", "KPHX_ADEX.BGL"));
  let blocked = false;
  try {
    await execFileAsync(process.execPath, ["scripts/intake-terminal4-source.mjs", sourceRoot, path.join(tempRoot, "blocked-report")], { cwd: process.cwd() });
  } catch (error) {
    blocked = String(error.stderr ?? error.message).includes("missing required source files");
  }
  if (!blocked) fail("missing ADEX source did not block intake");

  console.log("Terminal 4 source intake tooling contract passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
