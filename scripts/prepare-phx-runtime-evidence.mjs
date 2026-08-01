import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(path, "utf8");

const loadingAnchor = '    renderer.domElement.dataset.photoDetailLevel = "loading";\n    renderer.domElement.dataset.photoTileCount = "loading";';
const loadingReplacement = '    renderer.domElement.dataset.photoDetailLevel = "loading";\n    renderer.domElement.dataset.photoTextureMode = "loading";\n    renderer.domElement.dataset.photoRuntimeTileCount = "loading";\n    renderer.domElement.dataset.photoMaxTextureDimension = "loading";\n    renderer.domElement.dataset.photoTileCount = "loading";';
const readyAnchor = '        renderer.domElement.dataset.photoDetailLevel = environment.userData.authoredPhotoDetailLevel;\n        renderer.domElement.dataset.photoTileCount = String(environment.userData.authoredPhotoTileCount);';
const readyReplacement = '        renderer.domElement.dataset.photoDetailLevel = environment.userData.authoredPhotoDetailLevel;\n        renderer.domElement.dataset.photoTextureMode = environment.userData.authoredPhotoTextureMode;\n        renderer.domElement.dataset.photoRuntimeTileCount = String(environment.userData.authoredPhotoRuntimeTileCount);\n        renderer.domElement.dataset.photoMaxTextureDimension = String(environment.userData.authoredPhotoGround?.userData?.maxTextureDimension ?? "missing");\n        renderer.domElement.dataset.photoTileCount = String(environment.userData.authoredPhotoTileCount);';
const errorAnchor = '        renderer.domElement.dataset.photoDetailLevel = "load-error";\n        renderer.domElement.dataset.photoTileCount = "load-error";';
const errorReplacement = '        renderer.domElement.dataset.photoDetailLevel = "load-error";\n        renderer.domElement.dataset.photoTextureMode = "load-error";\n        renderer.domElement.dataset.photoRuntimeTileCount = "load-error";\n        renderer.domElement.dataset.photoMaxTextureDimension = "load-error";\n        renderer.domElement.dataset.photoTileCount = "load-error";';

for (const [anchor, replacement, label] of [
  [loadingAnchor, loadingReplacement, "loading evidence"],
  [readyAnchor, readyReplacement, "ready evidence"],
  [errorAnchor, errorReplacement, "error evidence"],
]) {
  if (source.includes(replacement)) continue;
  if (!source.includes(anchor)) throw new Error(`PHX runtime ${label} anchor is missing`);
  source = source.replace(anchor, replacement);
}

const terminalLoadingAnchor = '    renderer.domElement.dataset.terminal4ExactTextureCount = "loading";';
const terminalLoadingReplacement = `${terminalLoadingAnchor}
    renderer.domElement.dataset.terminal4A1LegacyBlockRemovedTriangles = "loading";
    renderer.domElement.dataset.terminal4A1LegacyBlockAuthority = "loading";`;
if (!source.includes('dataset.terminal4A1LegacyBlockRemovedTriangles = "loading"')) {
  if (!source.includes(terminalLoadingAnchor)) throw new Error("PHX runtime A1 authored-cleanup loading anchor is missing");
  source = source.replace(terminalLoadingAnchor, terminalLoadingReplacement);
}

const terminalReadyAnchor = '        renderer.domElement.dataset.terminal4ExactTextureCount = String(environment.userData.authoredTerminal4ExactTextureCount);';
const terminalReadyReplacement = `${terminalReadyAnchor}
        renderer.domElement.dataset.terminal4A1LegacyBlockRemovedTriangles = String(environment.userData.authoredTerminal4A1LegacyBlockRemovedTriangles ?? 0);
        renderer.domElement.dataset.terminal4A1LegacyBlockAuthority = environment.userData.authoredTerminal4A1LegacyBlockAuthority || "missing";`;
if (!source.includes("dataset.terminal4A1LegacyBlockRemovedTriangles = String(environment.userData.authoredTerminal4A1LegacyBlockRemovedTriangles")) {
  if (!source.includes(terminalReadyAnchor)) throw new Error("PHX runtime A1 authored-cleanup ready anchor is missing");
  source = source.replace(terminalReadyAnchor, terminalReadyReplacement);
}

const terminalErrorAnchor = '        renderer.domElement.dataset.terminal4Position = "load-error";';
const terminalErrorReplacement = `        renderer.domElement.dataset.terminal4A1LegacyBlockRemovedTriangles = "load-error";
        renderer.domElement.dataset.terminal4A1LegacyBlockAuthority = "load-error";
${terminalErrorAnchor}`;
if (!source.includes('dataset.terminal4A1LegacyBlockRemovedTriangles = "load-error"')) {
  if (!source.includes(terminalErrorAnchor)) throw new Error("PHX runtime A1 authored-cleanup error anchor is missing");
  source = source.replace(terminalErrorAnchor, terminalErrorReplacement);
}

for (const token of [
  'dataset.photoTextureMode = "loading"',
  'dataset.photoRuntimeTileCount = "loading"',
  'dataset.photoMaxTextureDimension = "loading"',
  'dataset.photoTextureMode = environment.userData.authoredPhotoTextureMode',
  'dataset.photoRuntimeTileCount = String(environment.userData.authoredPhotoRuntimeTileCount)',
  'dataset.photoMaxTextureDimension = String(environment.userData.authoredPhotoGround?.userData?.maxTextureDimension ?? "missing")',
  'dataset.terminal4A1LegacyBlockRemovedTriangles = "loading"',
  "dataset.terminal4A1LegacyBlockRemovedTriangles = String(environment.userData.authoredTerminal4A1LegacyBlockRemovedTriangles",
  "dataset.terminal4A1LegacyBlockAuthority = environment.userData.authoredTerminal4A1LegacyBlockAuthority",
  'dataset.terminal4A1LegacyBlockRemovedTriangles = "load-error"',
]) {
  if (!source.includes(token)) throw new Error(`PHX runtime evidence missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
await import("./prepare-direct-inspection-launch-v28.mjs");
console.log("Prepared live PHX runtime evidence for native-resolution ground tiling, maximum texture dimension, the exact A1 authored-block cleanup and direct tug inspection launch.");
