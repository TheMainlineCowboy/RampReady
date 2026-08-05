#!/usr/bin/env node

import { createHash } from "node:crypto";

const listingId = "98550208-ab83-4b27-aa2e-ea21298fec8a";
const expected = { bytes: 31_459_796, sha256: "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0" };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const headers = { "user-agent": "Mozilla/5.0 RampReady exact-upload recovery", accept: "application/json,text/html,*/*" };

async function fetchBytes(url) {
  try {
    const response = await fetch(url, { headers, redirect: "follow" });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { url: response.url, status: response.status, type: response.headers.get("content-type") || "", bytes };
  } catch (error) {
    return { url, error: error?.message || String(error), bytes: Buffer.alloc(0) };
  }
}
function collect(value, path = "root", out = []) {
  if (typeof value === "string") {
    if (/https?:\/\//i.test(value) || /glb|gltf|archive|download|distribution|file|asset|format/i.test(path + value)) out.push({ path, value });
  } else if (Array.isArray(value)) value.forEach((entry, index) => collect(entry, `${path}[${index}]`, out));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => collect(entry, `${path}.${key}`, out));
  return out;
}

const endpoints = [
  `https://www.fab.com/i/listings/${listingId}`,
  `https://www.fab.com/listings/${listingId}`,
  `https://www.fab.com/i/listings/${listingId}/formats`,
  `https://www.fab.com/i/listings/${listingId}/assets`,
  `https://www.fab.com/i/listings/${listingId}/files`,
  `https://www.fab.com/i/listings/${listingId}/download`,
];
const candidates = new Map();
for (const endpoint of endpoints) {
  const result = await fetchBytes(endpoint);
  console.log(`FAB_PROBE_ENDPOINT ${JSON.stringify({ endpoint, finalUrl: result.url, status: result.status, type: result.type, bytes: result.bytes.length, sha256: sha256(result.bytes), error: result.error })}`);
  if (result.status !== 200) continue;
  if (/json/i.test(result.type)) {
    let data;
    try { data = JSON.parse(result.bytes.toString("utf8")); } catch { continue; }
    const strings = collect(data);
    console.log(`FAB_PROBE_JSON_KEYS ${JSON.stringify(strings.filter(x => /glb|gltf|archive|download|distribution|file|asset|format/i.test(x.path + x.value)).slice(0,300))}`);
    for (const entry of strings) if (/^https?:\/\//i.test(entry.value)) candidates.set(entry.value, entry.path);
  } else {
    const text = result.bytes.toString("utf8");
    const urls = [...text.matchAll(/https?:\\?\/\\?\/[A-Za-z0-9_?&=%.:\/~+\-]+/g)].map(m => m[0].replace(/\\\//g, "/"));
    for (const url of urls) if (/glb|gltf|archive|download|file|asset|cdn|storage/i.test(url)) candidates.set(url, "html");
    const snippets = [...text.matchAll(/.{0,160}(?:glb|gltf|archive|download|distribution|asset_formats|assetFormats|files).{0,320}/gi)].map(m=>m[0]).slice(0,100);
    console.log(`FAB_PROBE_HTML_SNIPPETS ${JSON.stringify(snippets)}`);
  }
}
console.log(`FAB_PROBE_CANDIDATE_COUNT ${candidates.size}`);
let checked = 0;
for (const [url, sourcePath] of candidates) {
  if (checked++ >= 120) break;
  const result = await fetchBytes(url);
  const digest = sha256(result.bytes);
  console.log(`FAB_PROBE_CANDIDATE ${JSON.stringify({ sourcePath, url, finalUrl: result.url, status: result.status, type: result.type, bytes: result.bytes.length, sha256: digest, exact: result.bytes.length === expected.bytes && digest === expected.sha256, error: result.error })}`);
}
