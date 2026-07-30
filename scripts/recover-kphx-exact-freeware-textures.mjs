import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const PAGE_URL = "https://flyawaysimulation.com/downloads/files/9028/fsx-phoenix-sky-harbor-international-scenery/";
const OUTPUT_DIR = path.resolve(process.argv[2] ?? "source-assets/kphx-exact-terminal4");
const REPORT_PATH = path.resolve(process.argv[3] ?? "reports/kphx-exact-texture-recovery.json");
const CACHE_DIR = path.resolve(".cache/kphx-exact-texture-recovery");
const ARCHIVE_PATH = path.join(CACHE_DIR, "phx_sky_harbor.zip");
const TARGETS = Object.freeze([
  "phx_term400_0.dds",
  "phx_term400_0_lm.dds",
  "phx_term400_1.dds",
  "phx_term400_1_lm.dds",
  "parkramps2.bmp",
  "parkramps2_lm.bmp",
  "phxramplight.bmp",
  "phxramplight_lm.bmp",
  "m1dgjetway.bmp",
  "m1dgjetway_lm.bmp",
]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cookieJar = new Map();
const absorbCookies = (headers) => {
  const values = headers.getSetCookie?.() ?? [];
  for (const value of values) {
    const first = value.split(";", 1)[0];
    const equals = first.indexOf("=");
    if (equals > 0) cookieJar.set(first.slice(0, equals).trim(), first.slice(equals + 1).trim());
  }
};
const cookieHeader = () => [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
const headersFor = (referer = PAGE_URL) => ({
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36 RampReady-Exact-Source-Recovery",
  Accept: "text/html,application/xhtml+xml,application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
  Referer: referer,
  ...(cookieJar.size ? { Cookie: cookieHeader() } : {}),
});
const isZip = (bytes, contentType = "") => bytes.length >= 4
  && bytes[0] === 0x50 && bytes[1] === 0x4b
  && /zip|octet-stream|download|binary/i.test(contentType || "application/zip");
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? ""]));
const htmlForms = (html, baseUrl) => [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map((match) => {
  const open = match[0].match(/^<form\b[^>]*>/i)?.[0] ?? "";
  const attrs = attributes(open);
  const fields = [...match[0].matchAll(/<input\b[^>]*>/gi)]
    .map((entry) => attributes(entry[0]))
    .filter((entry) => entry.name && !["submit", "button"].includes((entry.type || "").toLowerCase()))
    .map((entry) => [entry.name, entry.value ?? ""]);
  return {
    action: new URL(attrs.action || baseUrl, baseUrl).href,
    method: (attrs.method || "get").toUpperCase(),
    fields,
    downloadLike: /download|d_op|phx_sky_harbor|19\.98/i.test(match[0]),
    snippet: match[0].slice(0, 1800),
  };
});

await rm(CACHE_DIR, { recursive: true, force: true });
await mkdir(CACHE_DIR, { recursive: true });
await mkdir(OUTPUT_DIR, { recursive: true });
await mkdir(path.dirname(REPORT_PATH), { recursive: true });

const steps = [];
let response = await fetch(PAGE_URL, { headers: headersFor(), redirect: "manual" });
absorbCookies(response.headers);
let bytes = Buffer.from(await response.arrayBuffer());
steps.push({ method: "GET", url: PAGE_URL, status: response.status, location: response.headers.get("location"), contentType: response.headers.get("content-type"), bytes: bytes.length, sha256: sha256(bytes) });
if (!response.ok) throw new Error(`KPHX freeware page returned HTTP ${response.status}`);

let currentUrl = response.url || PAGE_URL;
let archiveBytes = null;
let html = bytes.toString("utf8");
for (let attempt = 0; attempt < 8 && !archiveBytes; attempt += 1) {
  const forms = htmlForms(html, currentUrl);
  const form = forms.find((entry) => entry.downloadLike) ?? forms[0];
  if (!form) break;
  const body = new URLSearchParams(form.fields);
  if (!body.has("d_op")) body.set("d_op", "get");
  const method = form.method === "GET" ? "GET" : "POST";
  let requestUrl = form.action;
  const request = { headers: headersFor(currentUrl), redirect: "manual" };
  if (method === "GET") {
    const url = new URL(requestUrl);
    for (const [name, value] of body) url.searchParams.set(name, value);
    requestUrl = url.href;
  } else {
    request.method = "POST";
    request.headers["Content-Type"] = "application/x-www-form-urlencoded";
    request.body = body.toString();
  }
  response = await fetch(requestUrl, request);
  absorbCookies(response.headers);
  bytes = Buffer.from(await response.arrayBuffer());
  steps.push({ method, url: requestUrl, fields: [...body.keys()], status: response.status, location: response.headers.get("location"), contentType: response.headers.get("content-type"), contentDisposition: response.headers.get("content-disposition"), bytes: bytes.length, sha256: sha256(bytes) });

  if (isZip(bytes, response.headers.get("content-type") || "")) {
    archiveBytes = bytes;
    break;
  }
  const location = response.headers.get("location");
  if (location && response.status >= 300 && response.status < 400) {
    let nextUrl = new URL(location, requestUrl).href;
    for (let redirect = 0; redirect < 6; redirect += 1) {
      response = await fetch(nextUrl, { headers: headersFor(requestUrl), redirect: "manual" });
      absorbCookies(response.headers);
      bytes = Buffer.from(await response.arrayBuffer());
      steps.push({ method: "GET", url: nextUrl, status: response.status, location: response.headers.get("location"), contentType: response.headers.get("content-type"), contentDisposition: response.headers.get("content-disposition"), bytes: bytes.length, sha256: sha256(bytes) });
      if (isZip(bytes, response.headers.get("content-type") || "")) {
        archiveBytes = bytes;
        break;
      }
      const nextLocation = response.headers.get("location");
      if (!(nextLocation && response.status >= 300 && response.status < 400)) break;
      nextUrl = new URL(nextLocation, nextUrl).href;
    }
    if (archiveBytes) break;
  }
  currentUrl = response.url || requestUrl;
  html = bytes.toString("utf8");
}

if (!archiveBytes) {
  const report = {
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    conclusion: "archive-not-recovered",
    pageUrl: PAGE_URL,
    steps,
    finalHtmlSnippet: html.slice(0, 5000),
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  throw new Error(`Exact KPHX freeware archive was not recovered after ${steps.length} HTTP steps`);
}

await writeFile(ARCHIVE_PATH, archiveBytes);
const listing = spawnSync("unzip", ["-Z1", ARCHIVE_PATH], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
if (listing.error) throw listing.error;
if (listing.status !== 0) throw new Error(`Unable to list KPHX freeware archive: ${listing.stderr || listing.stdout}`);
const entries = listing.stdout.split(/\r?\n/).filter(Boolean);
const entryByBase = new Map(entries.map((entry) => [path.posix.basename(entry).toLowerCase(), entry]));
const recovered = [];
for (const target of TARGETS) {
  const entry = entryByBase.get(target.toLowerCase());
  if (!entry) throw new Error(`KPHX freeware archive is missing expected ${target}`);
  const extraction = spawnSync("unzip", ["-p", ARCHIVE_PATH, entry], { encoding: null, maxBuffer: 32 * 1024 * 1024 });
  if (extraction.error) throw extraction.error;
  if (extraction.status !== 0) throw new Error(`Unable to extract ${entry}: ${Buffer.from(extraction.stderr || "").toString("utf8")}`);
  const fileBytes = Buffer.from(extraction.stdout);
  if (!fileBytes.length) throw new Error(`${entry} extracted as an empty file`);
  const outputName = target.toUpperCase();
  await writeFile(path.join(OUTPUT_DIR, outputName), fileBytes);
  recovered.push({ target: outputName, archiveEntry: entry, bytes: fileBytes.length, sha256: sha256(fileBytes), magicHex: fileBytes.subarray(0, 16).toString("hex") });
}

const manifest = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  sourcePage: PAGE_URL,
  sourceArchiveName: "phx_sky_harbor.zip",
  sourceArchiveBytes: archiveBytes.length,
  sourceArchiveSha256: sha256(archiveBytes),
  sourceArchiveStored: false,
  sourceArchiveEntryCount: entries.length,
  exactRecoveredFileCount: recovered.length,
  recovered,
  licenseContext: "Original published freeware scenery package; only exact Terminal 4 and jetway texture dependencies retained.",
};
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(REPORT_PATH, `${JSON.stringify({ schemaVersion: 1, conclusion: "success", steps, manifest }, null, 2)}\n`);
await rm(ARCHIVE_PATH, { force: true });
console.log(JSON.stringify({ archiveBytes: manifest.sourceArchiveBytes, archiveSha256: manifest.sourceArchiveSha256, archiveEntries: entries.length, recovered: recovered.map(({ target, bytes, sha256: hash }) => ({ target, bytes, sha256: hash })) }, null, 2));
