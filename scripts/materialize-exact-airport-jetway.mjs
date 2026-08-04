const uid = "6067e855917e498abee3d98076293cc6";
const decode = (value) => value
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/gi, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
const response = await fetch(`https://sketchfab.com/models/${uid}/embed?api_log=1`, {
  headers: { "User-Agent": "Mozilla/5.0 RampReady supplied-jetway geometry probe" },
});
if (!response.ok) throw new Error(`embed HTTP ${response.status}`);
const html = await response.text();
const match = html.match(/<[^>]+id=["']js-dom-data-prefetched-data["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
if (!match) throw new Error("prefetched data missing");
const data = JSON.parse(decode(match[1].trim()).replace(/^<!--\s*/, "").replace(/\s*-->$/, ""));
const modelKey = Object.keys(data).find((key) => key === `/i/models/${uid}`);
const model = data[modelKey];
const hits = [];
const seen = new Set();
function walk(value, path = "$", depth = 0) {
  if (depth > 12 || value == null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (/file|archive|revision|scene|osg|model|uri|url|source/i.test(key)) {
      const serialized = typeof child === "string" ? child : JSON.stringify(child);
      hits.push({ path: childPath, type: Array.isArray(child) ? "array" : typeof child, value: serialized.slice(0, 1600) });
    }
    walk(child, childPath, depth + 1);
  }
}
walk(model);
console.log(`JETWAY_MODEL_TOP_KEYS ${JSON.stringify(Object.keys(model || {}))}`);
console.log(`JETWAY_MODEL_PATHS ${JSON.stringify(hits)}`);
const endpoints = [
  `/i/models/${uid}/viewerdata`, `/i/models/${uid}/viewer-data`, `/i/models/${uid}/files`,
  `/i/models/${uid}/archives`, `/i/models/${uid}/optimized`, `/i/models/${uid}/scene`,
  `/models/${uid}/viewerdata`, `/models/${uid}/files`,
];
for (const endpoint of endpoints) {
  const probe = await fetch(`https://sketchfab.com${endpoint}`, {
    headers: { "User-Agent": "Mozilla/5.0 RampReady supplied-jetway geometry probe", "Accept": "application/json,text/plain,*/*" },
    redirect: "manual",
  });
  const body = await probe.text();
  console.log(`JETWAY_ENDPOINT ${JSON.stringify({ endpoint, status: probe.status, location: probe.headers.get("location"), bytes: body.length, preview: body.slice(0, 1800) })}`);
}
throw new Error("JETWAY_GEOMETRY_PROBE_2_COMPLETE");
