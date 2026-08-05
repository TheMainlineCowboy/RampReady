import { createHash } from "node:crypto";

const uid = "6067e855917e498abee3d98076293cc6";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const endpoint = `https://sketchfab.com/i/models/${uid}`;
const summarizeResponse = async (label, url) => {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "RampReady exact-asset identity verifier/1.0", accept: "application/json,text/html,*/*" },
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const location = response.headers.get("location") || "";
    const text = bytes.toString("utf8");
    console.log(`${label} url=${url} status=${response.status} bytes=${bytes.length} sha256=${sha256(bytes)} type=${response.headers.get("content-type") || ""} location=${location ? new URL(location, url).origin + new URL(location, url).pathname : ""} body=${JSON.stringify(text.slice(0, 1200))}`);
    return { response, bytes, text };
  } catch (error) {
    console.log(`${label}_ERROR url=${url} error=${error?.message || error}`);
    return null;
  }
};

try {
  const response = await fetch(endpoint, {
    redirect: "follow",
    headers: { "user-agent": "RampReady exact-asset identity verifier/1.0" },
  });
  const data = await response.json();
  console.log(`JETWAY_ORIGIN_MODEL status=${response.status} uid=${data.uid || uid} name=${JSON.stringify(data.name)} faces=${data.faceCount} vertices=${data.vertexCount} archiveSize=${data.archiveSize} mayDownload=${data.mayDownloadThisModel}`);
  console.log(`JETWAY_ORIGIN_METADATA ${JSON.stringify({
    textureCount: data.metadata?.textureCount,
    materialCount: data.metadata?.materialCount,
    uvMapped: data.metadata?.uvMapped,
    sourceFiles: data.metadata?.sourceFiles,
    textureFiles: data.metadata?.textureFiles,
    version: data.version,
    ext: data.ext,
    originalFileName: data.originalFileName,
  })}`);
  console.log(`JETWAY_ORIGIN_ARCHIVE_STATUS ${JSON.stringify(data.archivesStatus || null)}`);

  const currentVersionUid = data.version?.uid || "";
  const historicalEndpoints = [
    `https://sketchfab.com/i/models/${uid}/versions`,
    `https://sketchfab.com/i/models/${uid}/versions?offset=0&limit=100`,
    `https://sketchfab.com/i/models/${uid}/modelversions`,
    `https://api.sketchfab.com/v3/models/${uid}/versions`,
    currentVersionUid && `https://sketchfab.com/i/models/${uid}/versions/${currentVersionUid}`,
    currentVersionUid && `https://sketchfab.com/i/models/${uid}/versions/${currentVersionUid}/textures?optimized=1`,
  ].filter(Boolean);
  for (const url of historicalEndpoints) await summarizeResponse("JETWAY_VERSION_ENDPOINT", url);

  const archiveEndpoints = [
    `https://sketchfab.com/i/models/${uid}/download`,
    `https://sketchfab.com/i/models/${uid}/download?archive_type=glb`,
    `https://sketchfab.com/i/models/${uid}/archives`,
    `https://sketchfab.com/i/models/${uid}/archives/glb`,
    currentVersionUid && `https://sketchfab.com/i/models/${uid}/versions/${currentVersionUid}/download`,
    currentVersionUid && `https://sketchfab.com/i/models/${uid}/versions/${currentVersionUid}/download?archive_type=glb`,
    `https://api.sketchfab.com/v3/models/${uid}/download`,
  ].filter(Boolean);
  for (const archiveEndpoint of archiveEndpoints) await summarizeResponse("JETWAY_ORIGIN_ARCHIVE_ENDPOINT", archiveEndpoint);

  const candidates = [];
  const visit = (value, keyPath = "root") => {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) {
      if (/(osgjs|texture|file|archive|source|model|version)/i.test(keyPath + value)) candidates.push({ keyPath, url: value });
      return;
    }
    if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, `${keyPath}[${index}]`));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => visit(entry, `${keyPath}.${key}`));
  };
  visit(data);
  const unique = [...new Map(candidates.map((entry) => [entry.url, entry])).values()].slice(0, 80);
  console.log(`JETWAY_ORIGIN_CANDIDATE_COUNT ${unique.length}`);
  for (const candidate of unique) {
    try {
      const assetResponse = await fetch(candidate.url, { redirect: "follow" });
      const bytes = Buffer.from(await assetResponse.arrayBuffer());
      const parsed = new URL(candidate.url);
      console.log(`JETWAY_ORIGIN_ASSET key=${candidate.keyPath} status=${assetResponse.status} bytes=${bytes.length} sha256=${sha256(bytes)} type=${assetResponse.headers.get("content-type") || ""} host=${parsed.host} path=${parsed.pathname}`);
      if (/osgjsUrl$/i.test(candidate.keyPath) && bytes.length <= 64 * 1024) {
        console.log(`JETWAY_ORIGIN_OSGJS_BASE64 key=${candidate.keyPath} bytes=${bytes.length} sha256=${sha256(bytes)} data=${bytes.toString("base64")}`);
      }
    } catch (error) {
      console.log(`JETWAY_ORIGIN_ASSET_ERROR key=${candidate.keyPath} error=${error?.message || error}`);
    }
  }
} catch (error) {
  console.log(`JETWAY_ORIGIN_PROBE_ERROR endpoint=${endpoint} error=${error?.message || error}`);
}
