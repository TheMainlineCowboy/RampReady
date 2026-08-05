#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, ".jetway-source-staging");
const names = (await readdir(dir)).filter((name) => /^chunk\d{3}\.b64$/.test(name)).sort();
const parts = [];
for (const name of names) {
  const encoded = (await readFile(path.join(dir, name), "utf8")).replace(/\s+/g, "");
  const decoded = Buffer.from(encoded, "base64");
  console.log(`JETWAY_SOURCE_CHUNK ${name} ${decoded.length} ${createHash("sha256").update(decoded).digest("hex")}`);
  parts.push(decoded);
}
const compressed = Buffer.concat(parts);
console.log(`JETWAY_SOURCE_STREAM ${names.length} ${compressed.length} ${createHash("sha256").update(compressed).digest("hex")} ${compressed.subarray(0,16).toString("hex")}`);
const result = spawnSync("xz", ["--decompress", "--stdout"], { input: compressed, encoding: null, maxBuffer: 256 * 1024 * 1024 });
console.log(`JETWAY_SOURCE_XZ_STATUS ${result.status}`);
if (result.stderr?.length) console.log(`JETWAY_SOURCE_XZ_STDERR ${result.stderr.toString("utf8").trim()}`);
if (result.status === 0) {
  const output = Buffer.from(result.stdout);
  const digest = createHash("sha256").update(output).digest("hex");
  console.log(`JETWAY_SOURCE_OUTPUT ${output.length} ${digest} ${output.subarray(0,32).toString("hex")}`);
  await mkdir(path.join(root, "public", "models", "airport-jetway"), { recursive: true });
  await writeFile(path.join(root, "public", "models", "airport-jetway", "source-chunks-output.bin"), output);
}
