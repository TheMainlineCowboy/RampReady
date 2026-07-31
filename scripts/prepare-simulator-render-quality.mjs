import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = 'dataset.renderQualityAuthority = "srgb-aces-balanced-pixel-ratio-inspection-ambient-v1"';
if (!source.includes(authority)) {
  const rendererAnchor = `    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "trainerCanvas";`;
  const rendererReplacement = `    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "trainerCanvas";
    renderer.domElement.dataset.renderQualityAuthority = "srgb-aces-balanced-pixel-ratio-inspection-ambient-v1";
    renderer.domElement.dataset.shadowMode = "training-dynamic";`;
  if (!source.includes(rendererAnchor)) throw new Error(`${trainerPath}: missing renderer quality anchor`);
  source = source.replace(rendererAnchor, rendererReplacement);

  const sunAnchor = `    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(18, 28, -14);
    sun.castShadow = true;
    scene.add(sun);`;
  const sunReplacement = `    const sun = new THREE.DirectionalLight(0xffffff, 2.05);
    sun.position.set(18, 28, -14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 520;
    sun.shadow.bias = -0.00012;
    sun.shadow.normalBias = 0.018;
    scene.add(sun);`;
  if (!source.includes(sunAnchor)) throw new Error(`${trainerPath}: missing directional light anchor`);
  source = source.replace(sunAnchor, sunReplacement);

  const toggleAnchor = `      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";
      const defaultInspectionPreset = INSPECTION_PRESETS.a1;`;
  const toggleReplacement = `      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";
      sim.renderer.shadowMap.enabled = !next;
      sim.renderer.domElement.dataset.shadowMode = next ? "inspection-ambient" : "training-dynamic";
      const defaultInspectionPreset = INSPECTION_PRESETS.a1;`;
  if (!source.includes(toggleAnchor)) throw new Error(`${trainerPath}: missing inspection shadow-mode anchor`);
  source = source.replace(toggleAnchor, toggleReplacement);
}

for (const token of [
  'dataset.renderQualityAuthority = "srgb-aces-balanced-pixel-ratio-inspection-ambient-v1"',
  'renderer.outputColorSpace = THREE.SRGBColorSpace',
  'renderer.toneMapping = THREE.ACESFilmicToneMapping',
  'renderer.shadowMap.type = THREE.PCFSoftShadowMap',
  'dataset.shadowMode = next ? "inspection-ambient" : "training-dynamic"',
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: missing simulator render quality token ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared balanced simulator rendering: sRGB/ACES output, capped high-DPI cost, soft training shadows and responsive ambient inspection mode.");
