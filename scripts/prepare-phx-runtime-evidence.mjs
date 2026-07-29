import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(path, "utf8");

const loadingAnchor = '    renderer.domElement.dataset.photoDetailLevel = "loading";\n    renderer.domElement.dataset.photoTileCount = "loading";';
const loadingReplacement = '    renderer.domElement.dataset.photoDetailLevel = "loading";\n    renderer.domElement.dataset.photoTextureMode = "loading";\n    renderer.domElement.dataset.photoRuntimeTileCount = "loading";\n    renderer.domElement.dataset.photoTileCount = "loading";';
const readyAnchor = '        renderer.domElement.dataset.photoDetailLevel = environment.userData.authoredPhotoDetailLevel;\n        renderer.domElement.dataset.photoTileCount = String(environment.userData.authoredPhotoTileCount);';
const readyReplacement = '        renderer.domElement.dataset.photoDetailLevel = environment.userData.authoredPhotoDetailLevel;\n        renderer.domElement.dataset.photoTextureMode = environment.userData.authoredPhotoTextureMode;\n        renderer.domElement.dataset.photoRuntimeTileCount = String(environment.userData.authoredPhotoRuntimeTileCount);\n        renderer.domElement.dataset.photoTileCount = String(environment.userData.authoredPhotoTileCount);';
const errorAnchor = '        renderer.domElement.dataset.photoDetailLevel = "load-error";\n        renderer.domElement.dataset.photoTileCount = "load-error";';
const errorReplacement = '        renderer.domElement.dataset.photoDetailLevel = "load-error";\n        renderer.domElement.dataset.photoTextureMode = "load-error";\n        renderer.domElement.dataset.photoRuntimeTileCount = "load-error";\n        renderer.domElement.dataset.photoTileCount = "load-error";';

for (const [anchor, replacement, label] of [
  [loadingAnchor, loadingReplacement, "loading evidence"],
  [readyAnchor, readyReplacement, "ready evidence"],
  [errorAnchor, errorReplacement, "error evidence"],
]) {
  if (!source.includes(anchor)) throw new Error(`PHX runtime ${label} anchor is missing`);
  source = source.replace(anchor, replacement);
}

for (const token of [
  'dataset.photoTextureMode = "loading"',
  'dataset.photoRuntimeTileCount = "loading"',
  'dataset.photoTextureMode = environment.userData.authoredPhotoTextureMode',
  'dataset.photoRuntimeTileCount = String(environment.userData.authoredPhotoRuntimeTileCount)',
]) {
  if (!source.includes(token)) throw new Error(`PHX runtime evidence missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared live PHX runtime evidence for native-resolution ground tiling.");
