import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readJpegDimensions } from "./intake-lektro-scan.mjs";

const source = await readFile(new URL("./intake-lektro-scan.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

const jpeg = Buffer.from([
  0xff, 0xd8,
  0xff, 0xc0,
  0x00, 0x11,
  0x08,
  0x10, 0x00,
  0x10, 0x00,
  0x03,
  0x01, 0x11, 0x00,
  0x02, 0x11, 0x00,
  0x03, 0x11, 0x00,
  0xff, 0xd9,
]);
assert.deepEqual(readJpegDimensions(jpeg), { width: 4096, height: 4096 });
assert.throws(() => readJpegDimensions(Buffer.from("not-a-jpeg")), /not a JPEG/u);

assert.equal(packageJson.scripts["intake:lektro-scan"], "node scripts/intake-lektro-scan.mjs");
assert.ok(packageJson.scripts.verify.includes("verify-lektro-intake-tooling.mjs"));
assert.ok(source.includes("createHash(\"sha256\")"));
assert.ok(source.includes("source-intake-report.json"));
assert.ok(source.includes("connected-components.json"));
assert.ok(source.includes("SHA256SUMS"));
assert.ok(source.includes("runtimeUseAllowed: false"));
assert.ok(source.includes("destructiveCleanupAllowed: passed"));
assert.ok(source.includes("analyzeLektroScanForCleanup"));

console.log("Verified reproducible KIRI scan source-intake tooling.");
