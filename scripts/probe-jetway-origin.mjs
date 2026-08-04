import { createHash } from "node:crypto";

const uid = "6067e855917e498abee3d98076293cc6";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const endpoint = `https://sketchfab.com/i/models/${uid}`;
try {
  const response = await fetch(endpoint, {
    redirect: "follow",
    headers: { "user-agent": "RampReady exact-asset identity verifier/1.0" },
  });
  const data = await response.json();
  console.log(`JETWAY_ORIGIN_MODEL status=${response.status} uid=${data.uid || uid} name=${JSON.stringify(data.name)} faces=${data.faceCount} vertices=${data.vertexCount} archiveSize=${data.archiveSize} modelSize=${data.modelSize} textureCount=${data.textureCount} mayDownload=${data.mayDownloadThisModel}`);
  console.log(`JETWAY_ORIGIN_SOURCE_FILES ${JSON.stringify(data.sourceFiles || null)}`);
  console.log(`JETWAY_ORIGIN_ARCHIVE_STATUS ${JSON.stringify(data.archivesStatus || null)}`);
  console.log(`JETWAY_ORIGIN_FILES_SHAPE ${JSON.stringify(data.files || null)}`);
  console.log(`JETWAY_ORIGIN_TEXTURE_FILES_SHAPE ${JSON.stringify(data.textureFiles || null)}`);

  const candidates = [];
  const visit = (value, keyPath = "root") => {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) {
      if (/(osgjs|texture|file|archive|source|model)/i.test(keyPath + value)) candidates.push({ keyPath, url: value });
      return;
    }
    if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, `${keyPath}[${index}]`));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => visit(entry, `${keyPath}.${key}`));
  };
  visit({
    osgjsUrl: data.osgjsUrl,
    files: data.files,
    textureFiles: data.textureFiles,
    sourceFiles: data.sourceFiles,
  });
  const unique = [...new Map(candidates.map((entry) => [entry.url, entry])).values()].slice(0, 40);
  console.log(`JETWAY_ORIGIN_CANDIDATE_COUNT ${unique.length}`);
  for (const candidate of unique) {
    try {
      const assetResponse = await fetch(candidate.url, { redirect: "follow" });
      const bytes = Buffer.from(await assetResponse.arrayBuffer());
      const parsed = new URL(candidate.url);
      console.log(`JETWAY_ORIGIN_ASSET key=${candidate.keyPath} status=${assetResponse.status} bytes=${bytes.length} sha256=${sha256(bytes)} type=${assetResponse.headers.get("content-type") || ""} host=${parsed.host} path=${parsed.pathname}`);
    } catch (error) {
      console.log(`JETWAY_ORIGIN_ASSET_ERROR key=${candidate.keyPath} error=${error?.message || error}`);
    }
  }
} catch (error) {
  console.log(`JETWAY_ORIGIN_PROBE_ERROR endpoint=${endpoint} error=${error?.message || error}`);
}
