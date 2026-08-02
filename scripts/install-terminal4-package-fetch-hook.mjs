import { readFile } from "node:fs/promises";
import path from "node:path";

const packageRoot = process.env.RAMPREADY_TERMINAL4_PACKAGE_ROOT
  ? path.resolve(process.env.RAMPREADY_TERMINAL4_PACKAGE_ROOT)
  : null;
const sourceCommit = process.env.RAMPREADY_TERMINAL4_SOURCE_COMMIT || "";
const originalFetch = globalThis.fetch;

if (!packageRoot || !sourceCommit) {
  throw new Error("Terminal 4 package fetch hook requires package root and pinned source commit");
}

const rawPrefix = `/TheMainlineCowboy/SkyHarborPhx/${sourceCommit}/`;

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
    if (error?.code === "ENOENT") return originalFetch(input, init);
    throw error;
  }
};
