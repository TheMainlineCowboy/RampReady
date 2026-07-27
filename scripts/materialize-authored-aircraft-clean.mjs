import { readFile, unlink, writeFile } from "node:fs/promises";

const repoRoot = new URL("../", import.meta.url);
const compressedUrl = new URL("assets/aircraft/crj700-user.glb.br", repoRoot);

let originalCompressed = null;
let compressedExisted = true;
try {
  originalCompressed = await readFile(compressedUrl);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  compressedExisted = false;
}

try {
  await import("./materialize-authored-aircraft.mjs");
} finally {
  if (compressedExisted) {
    await writeFile(compressedUrl, originalCompressed);
  } else {
    try {
      await unlink(compressedUrl);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}
