import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const distIndex = new URL("../dist/index.html", import.meta.url);
const distAssets = new URL("../dist/assets/", import.meta.url);
const terminal4TrainerPath = new URL("../src/components/RampReadyStandupTrainerTerminal4.jsx", import.meta.url);
const captureAuthority = "live-threejs-render-then-encode-evidence-v1";

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

function installLiveRenderedCaptureHook(source) {
  if (source.includes(captureAuthority)) return source;
  const anchor = "    simRef.current = sim;";
  if (!source.includes(anchor)) {
    throw new Error("Terminal 4 trainer is missing the live simulator assignment required for fallback evidence capture.");
  }
  const hook = `${anchor}\n\n    // ${captureAuthority}\n    // The guarded fallback is the actual Vite handoff when the legacy wrapper\n    // exits successfully before producing dist/. Install the evidence hook here\n    // so the shipped bundle can synchronously render and encode the current\n    // Three.js scene without preserveDrawingBuffer. Geometry is unchanged.\n    window.__rampReadyCaptureEvidencePng = () => {\n      scene.updateMatrixWorld(true);\n      camera.updateMatrixWorld(true);\n      renderer.render(scene, camera);\n      renderer.getContext()?.finish?.();\n      const encoded = renderer.domElement.toDataURL(\"image/png\");\n      if (!encoded || !encoded.startsWith(\"data:image/png;base64,\")) {\n        throw new Error(\"Live Three.js renderer did not return PNG evidence\");\n      }\n      renderer.domElement.dataset.evidenceCaptureAuthority = \"${captureAuthority}\";\n      return encoded;\n    };`;
  return source.replace(anchor, hook);
}

async function distContainsLiveCaptureHook() {
  try {
    const entries = await readdir(distAssets, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
      const bundled = await readFile(new URL(entry.name, distAssets), "utf8");
      if (bundled.includes(captureAuthority) && bundled.includes("__rampReadyCaptureEvidencePng")) return true;
    }
  } catch {
    return false;
  }
  return false;
}

// Run the existing simulator-quality pipeline in its own process. Several of
// its legacy imported preparers intentionally call process.exit(0) when their
// work is already satisfied. When imported in-process, one of those exits can
// terminate the entire production wrapper before build-production.mjs reaches
// Vite while still returning status 0 to npm. Isolating the legacy pipeline in
// a child prevents that successful early exit from terminating this guard.
await runNode("scripts/build-production-simulator-quality.mjs");

// A successful production build must leave an actual Vite artifact. If the
// legacy child returned 0 without reaching Vite, the legacy child has already
// restored the Terminal 4 trainer to its tracked baseline. The browser evidence
// hook therefore has to be installed AGAIN immediately before the real fallback
// Vite build; otherwise dist/ is valid but cannot capture the rendered scene.
if (!(await distExists())) {
  console.warn("Simulator-quality wrapper returned success without dist/index.html; forcing the final production verifier/Vite build with the live Three.js evidence hook installed at the actual fallback handoff.");
  const cleanTrainerSource = await readFile(terminal4TrainerPath, "utf8");
  const capturePreparedTrainerSource = installLiveRenderedCaptureHook(cleanTrainerSource);
  let fallbackError;
  let restorationError;
  try {
    await writeFile(terminal4TrainerPath, capturePreparedTrainerSource, "utf8");
    await runNode("scripts/build-production.mjs");
  } catch (error) {
    fallbackError = error;
  } finally {
    try {
      await writeFile(terminal4TrainerPath, cleanTrainerSource, "utf8");
      const restored = await readFile(terminal4TrainerPath, "utf8");
      if (restored !== cleanTrainerSource) {
        throw new Error("Guarded fallback failed to restore the Terminal 4 trainer after bundling the evidence hook.");
      }
    } catch (error) {
      restorationError = error;
    }
  }
  if (fallbackError && restorationError) {
    throw new AggregateError([fallbackError, restorationError], "Fallback production build and Terminal 4 trainer restoration both failed.");
  }
  if (restorationError) throw restorationError;
  if (fallbackError) throw fallbackError;
}

if (!(await distExists())) {
  throw new Error("Production build completed without dist/index.html.");
}
if (!(await distContainsLiveCaptureHook())) {
  throw new Error("Production artifact is missing the live Three.js render-then-encode evidence hook.");
}

console.log("Guarded simulator-quality production build produced dist/index.html with the live Three.js render-then-encode evidence hook and restored the tracked Terminal 4 trainer.");
