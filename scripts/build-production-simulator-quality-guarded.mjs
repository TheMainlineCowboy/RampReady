import { access } from "node:fs/promises";
import { spawn } from "node:child_process";

const distIndex = new URL("../dist/index.html", import.meta.url);

function runNode(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

async function distExists() {
  try {
    await access(distIndex);
    return true;
  } catch {
    return false;
  }
}

// Run the existing simulator-quality pipeline in its own process. Several of
// its legacy imported preparers intentionally call process.exit(0) when their
// work is already satisfied. When imported in-process, one of those exits can
// terminate the entire production wrapper before build-production.mjs reaches
// Vite while still returning status 0 to npm. Isolating the legacy pipeline in
// a child prevents that successful early exit from terminating this guard.
await runNode("scripts/build-production-simulator-quality.mjs");

// A successful production build must leave an actual Vite artifact. If the
// legacy child returned 0 without reaching Vite, force the final verifier/build
// in a fresh process against the already-prepared working tree. This changes no
// terminal, aircraft, tug, or jetway geometry; it only makes dist/ existence a
// non-negotiable production handoff.
if (!(await distExists())) {
  console.warn("Simulator-quality wrapper returned success without dist/index.html; forcing the final production verifier/Vite build in a fresh child process.");
  await runNode("scripts/build-production.mjs");
}

if (!(await distExists())) {
  throw new Error("Production build completed without dist/index.html.");
}

console.log("Guarded simulator-quality production build produced dist/index.html.");
