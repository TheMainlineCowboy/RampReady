import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = 'dataset.renderQualityAuthority = "srgb-aces-high-fidelity-dynamic-shadows-v2"';
if (!source.includes(authority)) {
  const rendererAnchor = `    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "trainerCanvas";`;
  const rendererReplacement = `    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    renderer.domElement.className = "trainerCanvas";
    renderer.domElement.dataset.renderQualityAuthority = "srgb-aces-high-fidelity-dynamic-shadows-v2";
    renderer.domElement.dataset.shadowMode = "dynamic-high-fidelity";`;
  if (!source.includes(rendererAnchor)) throw new Error(`${trainerPath}: missing renderer quality anchor`);
  source = source.replace(rendererAnchor, rendererReplacement);

  const sunAnchor = `    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(18, 28, -14);
    sun.castShadow = true;
    scene.add(sun);`;
  const sunReplacement = `    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(42, 68, -38);
    sun.castShadow = true;
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches === true;
    const shadowMapSize = coarsePointer ? 2048 : 4096;
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 240;
    sun.shadow.camera.left = -92;
    sun.shadow.camera.right = 92;
    sun.shadow.camera.top = 92;
    sun.shadow.camera.bottom = -92;
    sun.shadow.bias = -0.00008;
    sun.shadow.normalBias = 0.012;
    scene.add(sun);`;
  if (!source.includes(sunAnchor)) throw new Error(`${trainerPath}: missing directional light anchor`);
  source = source.replace(sunAnchor, sunReplacement);

  const toggleAnchor = '      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";';
  const toggleReplacement = `${toggleAnchor}
      sim.renderer.shadowMap.enabled = true;
      sim.renderer.shadowMap.needsUpdate = true;
      sim.renderer.domElement.dataset.shadowMode = "dynamic-high-fidelity";`;
  if (!source.includes(toggleAnchor)) throw new Error(`${trainerPath}: missing inspection shadow-mode anchor`);
  source = source.replace(toggleAnchor, toggleReplacement);
}

for (const token of [
  'dataset.renderQualityAuthority = "srgb-aces-high-fidelity-dynamic-shadows-v2"',
  'renderer.outputColorSpace = THREE.SRGBColorSpace',
  'renderer.toneMapping = THREE.ACESFilmicToneMapping',
  'renderer.shadowMap.type = THREE.PCFSoftShadowMap',
  'const shadowMapSize = coarsePointer ? 2048 : 4096',
  'dataset.shadowMode = "dynamic-high-fidelity"',
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: missing simulator render quality token ${token}`);
}

for (const forbidden of [
  "sim.renderer.shadowMap.enabled = !next",
  'dataset.shadowMode = next ? "inspection-ambient" : "training-dynamic"',
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: stale inspection shadow downgrade remains: ${forbidden}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared high-fidelity simulator rendering: sRGB/ACES output, full device pixel ratio up to 2x, 2K/4K soft dynamic shadows and no inspection-mode shadow downgrade.");
