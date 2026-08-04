const uid = "6067e855917e498abee3d98076293cc6";
const urls = [
  `https://sketchfab.com/i/models/${uid}`,
  `https://sketchfab.com/i/models/${uid}/status`,
  `https://sketchfab.com/models/${uid}/embed`,
];
for (const url of urls) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "RampReady exact-asset identity verifier/1.0" },
    });
    const text = await response.text();
    const matches = [...text.matchAll(/https?:\\?\/\\?\/[^\"'<>\\s]+/g)]
      .map((match) => match[0].replaceAll("\\/", "/"))
      .filter((value) => /sketchfab|amazonaws|cloudfront|fab\.com|model|archive|texture|gltf|glb|osgjs|bin/i.test(value));
    console.log(`JETWAY_ORIGIN_PROBE url=${url} status=${response.status} type=${response.headers.get("content-type") || ""} chars=${text.length}`);
    console.log(`JETWAY_ORIGIN_URLS ${JSON.stringify([...new Set(matches)].slice(0, 80))}`);
    console.log(`JETWAY_ORIGIN_KEYS ${JSON.stringify([...new Set([...text.matchAll(/\"([A-Za-z0-9_]*(?:archive|texture|model|viewer|file|url)[A-Za-z0-9_]*)\"\s*:/gi)].map((match) => match[1]))].slice(0, 100))}`);
  } catch (error) {
    console.log(`JETWAY_ORIGIN_PROBE_ERROR url=${url} error=${error?.message || error}`);
  }
}
