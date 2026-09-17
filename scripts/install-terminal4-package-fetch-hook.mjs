import { readFile } from "node:fs/promises";
import path from "node:path";

const packageRoot = process.env.RAMPREADY_TERMINAL4_PACKAGE_ROOT
  ? path.resolve(process.env.RAMPREADY_TERMINAL4_PACKAGE_ROOT)
  : null;
const sourceCommit = process.env.RAMPREADY_TERMINAL4_SOURCE_COMMIT || "";
const originalFetch = globalThis.fetch;
const transientStatuses = new Set([429, 500, 502, 503, 504]);
const fallbackAttempts = 5;
const fallbackBaseDelayMs = 750;

if (!packageRoot || !sourceCommit) {
  throw new Error("Terminal 4 package fetch hook requires package root and pinned source commit");
}

const rawPrefix = `/TheMainlineCowboy/SkyHarborPhx/${sourceCommit}/`;

async function fetchPinnedSourceWithRetry(input, init) {
  let lastResponse = null;
  for (let attempt = 1; attempt <= fallbackAttempts; attempt += 1) {
    const originalUrl = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (attempt > 1) originalUrl.searchParams.set("rrPackageRetry", String(attempt));
    const requestInput = typeof input === "string" || input instanceof URL ? originalUrl : new Request(originalUrl, input);
    const response = await originalFetch(requestInput, init);
    if (response.ok || !transientStatuses.has(response.status)) return response;
    lastResponse = response;
    if (attempt >= fallbackAttempts) break;
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.min(retryAfterSeconds * 1000, 8000)
      : fallbackBaseDelayMs * attempt;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return lastResponse;
}

globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname !== "raw.githubusercontent.com" || !url.pathname.startsWith(rawPrefix)) {
    return originalFetch(input, init);
  }

  const relativePath = decodeURIComponent(url.pathname.slice(rawPrefix.length));
  const localPath = path.resolve(packageRoot, relativePath);
  if (localPath !== packageRoot && !localPath.startsWith(`${packageRoot}${path.sep}`)) {
    throw new Error(`Terminal 4 package path escaped cache root: ${relativePath}`);
  }

  try {
    const bytes = await readFile(localPath);
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-length": String(bytes.length),
        "x-rampready-source": "mirrored-complete-package",
      },
    });
  } catch (error) {
    if (error?.code === "ENOENT") return fetchPinnedSourceWithRetry(input, init);
    throw error;
  }
};
