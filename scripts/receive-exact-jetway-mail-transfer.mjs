#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const API = "https://api.mail.tm";
const ROOT = path.resolve(".cache/exact-jetway-mail-transfer");
const STATE_PATH = path.join(ROOT, "mailbox.json");
const PUBLIC_ADDRESS_PATH = path.resolve(".jetway-transfer-mailbox.txt");
const EXPECTED_PARTS = Object.freeze([
  { file: "jetway-part-00.bin", bytes: 5_000_000, sha256: "b782c806bc17d9d35c3443d03edd3b6b121fd79f6f8f74edeb0b9f5942c72fea" },
  { file: "jetway-part-01.bin", bytes: 5_000_000, sha256: "4d48e7029051b783755c1ca70660f3744dd0050229b197a6458cbcf0857b7ce9" },
  { file: "jetway-part-02.bin", bytes: 5_000_000, sha256: "cf0904cc4e18e47c5f791ec29a196bd9d9daa2b436a3afe4148ef7bc2af15dd4" },
  { file: "jetway-part-03.bin", bytes: 5_000_000, sha256: "0a25db4e81f8c044c9822ac4260598dbc29335457712737d1f6709f95bd4ec30" },
  { file: "jetway-part-04.bin", bytes: 5_000_000, sha256: "ebc2e7ca8134f287bafc45559c88a31cceb591b2c6c990a7c2c31eb1b62dd997" },
  { file: "jetway-part-05.bin", bytes: 3_545_072, sha256: "842ba4cbb7ddf88e59b8dc35d927d20f37e9db440c2b4f55b7ff8682f30fb3ca" },
]);
const EXPECTED_ENCRYPTED = Object.freeze({ bytes: 28_545_072, sha256: "f37cb8b377042c47a71a212e961055f59b0da0d54734754fc08147d2d8e5e978" });
const EXPECTED_XZ = Object.freeze({ bytes: 28_545_048, sha256: "ef65b5d062dbb078c2dfea6d0ed2e97d166c16abc1b6eb7cab8dc610baca1177" });
const EXPECTED_GLB = Object.freeze({ bytes: 31_459_796, sha256: "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0" });
const SUBJECT_PREFIX = "RR137-EXACT-JETWAY-";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertIdentity(label, bytes, expected) {
  const digest = sha256(bytes);
  if (bytes.length !== expected.bytes || digest !== expected.sha256) {
    throw new Error(`${label} identity mismatch: ${bytes.length}/${digest}; expected ${expected.bytes}/${expected.sha256}`);
  }
  console.log(`${label} verified: ${bytes.length} bytes ${digest}`);
}

async function jsonRequest(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method || "GET"} ${url} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function createMailbox() {
  const domains = await jsonRequest(`${API}/domains?page=1`);
  const domain = domains?.["hydra:member"]?.find((entry) => entry.isActive)?.domain;
  if (!domain) throw new Error("mail.tm returned no active domain");
  const runId = String(process.env.GITHUB_RUN_ID || Date.now());
  const address = `rampready-${runId}-${randomBytes(3).toString("hex")}@${domain}`;
  const password = randomBytes(32).toString("hex");
  await jsonRequest(`${API}/accounts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  const tokenResponse = await jsonRequest(`${API}/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (!tokenResponse?.token) throw new Error("mail.tm did not return an access token");
  const state = { address, token: tokenResponse.token };
  await mkdir(ROOT, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state), { mode: 0o600 });
  await writeFile(PUBLIC_ADDRESS_PATH, `${address}\n`, "utf8");
  console.log(`JETWAY_MAILBOX_ADDRESS=${address}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `## Exact jetway transfer mailbox\n\nOne-time address: **${address}**\n`, { flag: "a" });
  }
  return state;
}

async function loadMailbox() {
  const state = JSON.parse(await readFile(STATE_PATH, "utf8"));
  if (!state?.address || !state?.token) throw new Error("Exact jetway mailbox state is incomplete");
  console.log(`JETWAY_MAILBOX_ADDRESS=${state.address}`);
  return state;
}

async function downloadAttachment(token, messageId, expected) {
  const headers = { authorization: `Bearer ${token}` };
  const detail = await jsonRequest(`${API}/messages/${messageId}`, { headers });
  const attachment = (detail?.attachments || []).find((entry) => entry.filename === expected.file) || detail?.attachments?.[0];
  if (!attachment?.downloadUrl) throw new Error(`${expected.file}: received message has no downloadable attachment`);
  const response = await fetch(new URL(attachment.downloadUrl, API), { headers, redirect: "follow" });
  if (!response.ok) throw new Error(`${expected.file}: attachment download returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assertIdentity(expected.file, bytes, expected);
  await writeFile(path.join(ROOT, expected.file), bytes);
  return bytes;
}

async function receiveAll(token) {
  const received = new Map();
  const headers = { authorization: `Bearer ${token}` };
  const deadline = Date.now() + 25 * 60 * 1000;
  while (Date.now() < deadline && received.size < EXPECTED_PARTS.length) {
    const listing = await jsonRequest(`${API}/messages?page=1`, { headers });
    for (const message of listing?.["hydra:member"] || []) {
      const index = EXPECTED_PARTS.findIndex((_, partIndex) => message.subject === `${SUBJECT_PREFIX}${String(partIndex).padStart(2, "0")}`);
      if (index < 0 || received.has(index)) continue;
      received.set(index, await downloadAttachment(token, message.id, EXPECTED_PARTS[index]));
      console.log(`Received exact jetway part ${index + 1}/${EXPECTED_PARTS.length}.`);
    }
    if (received.size < EXPECTED_PARTS.length) {
      console.log(`Waiting for encrypted exact jetway parts: ${received.size}/${EXPECTED_PARTS.length}`);
      await sleep(10_000);
    }
  }
  if (received.size !== EXPECTED_PARTS.length) throw new Error(`Timed out with ${received.size}/${EXPECTED_PARTS.length} exact jetway parts`);
  return Buffer.concat(EXPECTED_PARTS.map((_, index) => received.get(index)));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: null, maxBuffer: 128 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${String(result.stderr || "").trim()}`);
  return Buffer.from(result.stdout || []);
}

async function receiveAndMaterialize() {
  const transferKey = process.env.JETWAY_TRANSFER_KEY;
  if (!transferKey) throw new Error("JETWAY_TRANSFER_KEY is required");
  const { token } = await loadMailbox();
  const encrypted = await receiveAll(token);
  assertIdentity("Encrypted exact jetway payload", encrypted, EXPECTED_ENCRYPTED);
  const encryptedPath = path.join(ROOT, "Airport_Jetway.glb.xz.enc");
  await writeFile(encryptedPath, encrypted);
  const xz = run("openssl", ["enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000", "-pass", `pass:${transferKey}`, "-in", encryptedPath]);
  assertIdentity("Exact jetway XZ", xz, EXPECTED_XZ);
  const xzPath = path.join(ROOT, "Airport_Jetway.glb.xz");
  await writeFile(xzPath, xz);
  run("xz", ["-t", xzPath]);
  const glb = run("xz", ["-dc", xzPath]);
  assertIdentity("Airport_Jetway.glb", glb, EXPECTED_GLB);
  if (glb.toString("ascii", 0, 4) !== "glTF" || glb.readUInt32LE(4) !== 2 || glb.readUInt32LE(8) !== glb.length) {
    throw new Error("Exact Airport_Jetway.glb failed its GLB 2.0 header check");
  }
  const output = path.resolve("public/models/airport-jetway/Airport_Jetway.glb");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, glb);
  assertIdentity("Persisted Airport_Jetway.glb", await readFile(output), EXPECTED_GLB);
  console.log(`JETWAY_EXACT_GLB_READY=${output}`);
}

async function main() {
  await mkdir(ROOT, { recursive: true });
  const mode = process.argv[2] || "--all";
  if (mode === "--create-mailbox") return createMailbox();
  if (mode === "--receive") return receiveAndMaterialize();
  await createMailbox();
  return receiveAndMaterialize();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
