const MODEL_UID = "6067e855917e498abee3d98076293cc6";

function decodeEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

const response = await fetch(`https://sketchfab.com/models/${MODEL_UID}/embed?api_log=1`, {
  headers: { "User-Agent": "Mozilla/5.0 RampReady supplied-jetway geometry probe" },
  redirect: "follow",
});
if (!response.ok) throw new Error(`Official viewer returned HTTP ${response.status}`);
const html = await response.text();
const match = html.match(/<[^>]+id=["']js-dom-data-prefetched-data["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
if (!match) throw new Error("Official viewer did not expose prefetched data");
const serialized = decodeEntities(match[1].trim()).replace(/^<!--\s*/, "").replace(/\s*-->$/, "");
const data = JSON.parse(serialized);
const interesting = [];
for (const [key, value] of Object.entries(data)) {
  const text = JSON.stringify(value);
  const urls = [...new Set((text.match(/https?:\\?\/\\?\/[^"\\s]+/g) || []).map((url) => url.replaceAll("\\/", "/")))];
  const assetUrls = urls.filter((url) => /\.(?:zip|gz|xz|bin|gltf|glb|osgjs|json)(?:\?|$)/i.test(url) || /archive|model-file|files/i.test(url));
  const ids = [...new Set(text.match(/[0-9a-f]{32}/gi) || [])];
  if (assetUrls.length || /archive|file|model|revision/i.test(key)) {
    interesting.push({ key, bytes: text.length, ids, assetUrls, preview: text.slice(0, 1200) });
  }
}
console.log(`JETWAY_GEOMETRY_PREFETCH ${JSON.stringify(interesting)}`);
throw new Error("JETWAY_GEOMETRY_PROBE_COMPLETE");
