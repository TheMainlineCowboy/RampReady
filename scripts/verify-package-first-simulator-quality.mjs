import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const materializeCommand = packageJson.scripts?.["materialize:phx-terminal4"] || "";
if (!materializeCommand.includes("materialize-terminal4-package-first.mjs")) {
  throw new Error("Terminal 4 builds are not routed through the complete package mirror");
}

const packageMirror = fs.readFileSync("scripts/materialize-terminal4-package-first.mjs", "utf8");
for (const token of [
  "complete-pinned-scenery-and-texture-package-mirror-before-browser-conversion-v1",
  '"scenery/term4.BGL"',
  '"scenery/KPHX_ADEX.BGL"',
  "git/trees/${SOURCE_COMMIT}?recursive=1",
  "materialize-phx-terminal4.mjs",
  "packageImportAuthority",
]) {
  if (!packageMirror.includes(token)) throw new Error(`Package-first Terminal 4 mirror is missing ${token}`);
}

const fetchHook = fs.readFileSync("scripts/install-terminal4-package-fetch-hook.mjs", "utf8");
for (const token of [
  "RAMPREADY_TERMINAL4_PACKAGE_ROOT",
  "raw.githubusercontent.com",
  '"mirrored-complete-package"',
]) {
  if (!fetchHook.includes(token)) throw new Error(`Terminal 4 package fetch hook is missing ${token}`);
}

const legacyVerifierPath = process.argv[2] || "scripts/verify-simulator-quality-inspection-pass.mjs";
let verifier = fs.readFileSync(legacyVerifierPath, "utf8");
const oldWiringToken = `  "materialize-phx-terminal4.mjs",\n]) if (!terminalMaterializer.includes(token))`;
const newWiringToken = `  "materialize-terminal4-package-first.mjs",\n]) if (!terminalMaterializer.includes(token))`;
if (!verifier.includes(oldWiringToken)) {
  throw new Error("Simulator-quality verifier no longer contains the expected legacy materializer wiring anchor");
}
verifier = verifier.replace(oldWiringToken, newWiringToken);

const cacheDirectory = path.resolve(".cache/package-first-verifier");
fs.mkdirSync(cacheDirectory, { recursive: true });
const temporaryVerifier = path.join(cacheDirectory, `verify-${process.pid}-${Date.now()}.mjs`);
fs.writeFileSync(temporaryVerifier, verifier, "utf8");
try {
  await import(`${pathToFileURL(temporaryVerifier).href}?package-first=${Date.now()}`);
} finally {
  fs.rmSync(temporaryVerifier, { force: true });
}

console.log("RampReady package-first simulator-quality verification passed: complete pinned package mirroring is mandatory before the existing Terminal 4 geometry, texture, ground, tug and A1 contracts run.");
