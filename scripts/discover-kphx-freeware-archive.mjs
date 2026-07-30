import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PAGE_URL = "https://flyawaysimulation.com/downloads/files/9028/fsx-phoenix-sky-harbor-international-scenery/";
const outputPath = path.resolve(process.argv[2] ?? "reports/kphx-freeware-download-discovery.json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const absolute = (value, base = PAGE_URL) => {
  try { return new URL(value, base).href; } catch { return null; }
};
const unique = (values) => [...new Set(values.filter(Boolean))];
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? ""]));
const nearby = (text, needle, radius = 500) => {
  const lowered = text.toLowerCase();
  const index = lowered.indexOf(needle.toLowerCase());
  if (index < 0) return null;
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + needle.length + radius));
};

const response = await fetch(PAGE_URL, {
  headers: {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36 RampReady-Source-Recovery",
    Accept: "text/html,application/xhtml+xml",
  },
  redirect: "follow",
});
const html = await response.text();
if (!response.ok) throw new Error(`Freeware source page returned HTTP ${response.status}`);

const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map((match, index) => {
  const openTag = match[0].match(/^<form\b[^>]*>/i)?.[0] ?? "";
  const attrs = attributes(openTag);
  const inputs = [...match[0].matchAll(/<input\b[^>]*>/gi)].map((entry) => attributes(entry[0]));
  const buttons = [...match[0].matchAll(/<(?:button|input)\b[^>]*>/gi)].map((entry) => attributes(entry[0]));
  return {
    index,
    action: absolute(attrs.action || PAGE_URL),
    method: (attrs.method || "get").toLowerCase(),
    id: attrs.id ?? null,
    className: attrs.class ?? null,
    inputs,
    buttons,
    mentionsDownload: /download|19\.98|phx_sky_harbor/i.test(match[0]),
    snippet: match[0].slice(0, 2500),
  };
});

const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map((match) => attributes(match[0]));
const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((match) => attributes(match[0]));
const candidateUrls = unique([
  ...anchors.map((entry) => absolute(entry.href)),
  ...scripts.map((entry) => absolute(entry.src)),
  ...[...html.matchAll(/(?:https?:)?\/\/[^"'\s<>]+/gi)].map((match) => absolute(match[0])),
  ...[...html.matchAll(/["']([^"']*(?:download|files|phx_sky_harbor|\.zip)[^"']*)["']/gi)].map((match) => absolute(match[1])),
]).filter((url) => /download|files|zip|9028|flyaway/i.test(url));

const scriptEvidence = [];
for (const src of unique(scripts.map((entry) => absolute(entry.src))).slice(0, 40)) {
  try {
    const scriptResponse = await fetch(src, { headers: { "User-Agent": "RampReady-Source-Recovery" }, redirect: "follow" });
    const body = await scriptResponse.text();
    if (!scriptResponse.ok || !/download|file|zip|free/i.test(body)) continue;
    const snippets = [];
    for (const needle of ["download", "free", "zip", "files/9028", "phx_sky_harbor"]) {
      const snippet = nearby(body, needle, 350);
      if (snippet) snippets.push({ needle, snippet });
    }
    scriptEvidence.push({ src, status: scriptResponse.status, bytes: Buffer.byteLength(body), sha256: sha256(body), snippets });
  } catch (error) {
    scriptEvidence.push({ src, error: error instanceof Error ? error.message : String(error) });
  }
}

const report = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  page: {
    requestedUrl: PAGE_URL,
    finalUrl: response.url,
    status: response.status,
    bytes: Buffer.byteLength(html),
    sha256: sha256(html),
  },
  exactFilesConfirmedByPublishedInventory: [
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
  ],
  forms,
  candidateUrls,
  scriptEvidence,
  pageSnippets: {
    downloadFree: nearby(html, "Download Free", 1200),
    archiveName: nearby(html, "phx_sky_harbor.zip", 1200),
    fileId: nearby(html, "9028", 1200),
  },
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ forms: forms.length, downloadForms: forms.filter((entry) => entry.mentionsDownload).length, candidateUrls: candidateUrls.length, scriptsWithEvidence: scriptEvidence.length }, null, 2));
