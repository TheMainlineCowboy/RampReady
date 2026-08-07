import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const CANONICAL_ROUTE_AUTHORITY = "source-gate-apron-presets-with-exact-a1-terminal-joint-subview-and-chase-a14-b14-b15-v11";
const A1_CAMERA_AUTHORITY = "fixed-terminal-wall-rotunda-joint-evidence-a1-v10";
const VISUAL_BRIDGE_AUTHORITY = "real-final-inspection-preset-callback-v2";
const INITIAL_PRESET_AUTHORITY = "launch-time-inspection-preset-before-browser-interaction-v1";
const INITIAL_SUBVIEW_AUTHORITY = "launch-time-a1-terminal-joint-subview-v1";
let source = fs.readFileSync(trainerPath, "utf8");

// A14 previously used a guessed fixed camera that rendered empty pavement.
// Keep the source gate tug position but use the same proven chase/orbit framing
// as B14/B15 so the camera follows the actual source-gate location.
const exactPreset = `  a14: Object.freeze({ id: "a14", label: "A concourse midpoint", x: 218.45, z: -86.52, yaw: 2.88, cameraYaw: 2.19, cameraDistance: 32 }),`;
const existingA14Block = /  a14: Object\.freeze\(\{[\s\S]*?\n  \}\),/;
const oneLineA14 = /  a14: Object\.freeze\(\{ id: "a14", label: "A concourse midpoint", x: 218\.45, z: -86\.52, yaw: 2\.88, cameraYaw: -?\d+(?:\.\d+)?, cameraDistance: \d+(?:\.\d+)? \}\),/;
if (existingA14Block.test(source)) {
  source = source.replace(existingA14Block, exactPreset);
} else if (oneLineA14.test(source)) {
  source = source.replace(oneLineA14, exactPreset);
} else if (!source.includes(exactPreset)) {
  throw new Error(`${trainerPath}: A14 inspection preset anchor is missing`);
}

const canonicalAuthorityBlock = `    canvas.dataset.inspectionCameraAuthority = preset.cameraAuthority || (preset.cameraPosition
      ? "${A1_CAMERA_AUTHORITY}"
      : "free-orbit-follow-tug");`;
if (!source.includes(canonicalAuthorityBlock)) {
  const genericAuthorityBlock = /    canvas\.dataset\.inspectionCameraAuthority = preset(?:\.cameraAuthority \|\| \()?\.cameraPosition\n      \? "[^"]+"\n      : "free-orbit-follow-tug"\)?;/;
  if (!genericAuthorityBlock.test(source)) {
    throw new Error(`${trainerPath}: inspection camera authority anchor is missing`);
  }
  source = source.replace(genericAuthorityBlock, canonicalAuthorityBlock);
}

source = source.replace(
  /source-gate-apron-presets-with[^"\n]*-a1-a14-b14-b15-v\d+/g,
  CANONICAL_ROUTE_AUTHORITY,
);
source = source.replace(
  /oblique-(?:measured|photo-registered)-terminal-corner-a1-v\d+|oblique-measured-final-cab-and-aircraft-a1-v\d+|fixed-terminal-wall-rotunda-joint-evidence-a1-v\d+/g,
  A1_CAMERA_AUTHORITY,
);

// Browser evidence can request a preset in the URL and launch the trainer
// already in inspection mode. Install that preset into the real trainer before
// any external browser automation has to touch the fully loaded Three.js scene.
if (!source.includes('initialInspectionPreset = "a1",')) {
  const propAnchor = '  initialInspectionMode = false,\n  onChangeEquipment,';
  if (!source.includes(propAnchor)) throw new Error(`${trainerPath}: initial inspection mode prop anchor is missing`);
  source = source.replace(
    propAnchor,
    '  initialInspectionMode = false,\n  initialInspectionPreset = "a1",\n  onChangeEquipment,',
  );
}
if (!source.includes("const resolvedInitialInspectionPreset =")) {
  const mountAnchor = "  const mountRef = useRef(null);";
  if (!source.includes(mountAnchor)) throw new Error(`${trainerPath}: trainer mount anchor is missing`);
  source = source.replace(
    mountAnchor,
    `  // ${INITIAL_PRESET_AUTHORITY}\n  const resolvedInitialInspectionPreset = Object.prototype.hasOwnProperty.call(INSPECTION_PRESETS, initialInspectionPreset)\n    ? initialInspectionPreset\n    : "a1";\n${mountAnchor}`,
  );
}
source = source.replace(
  '  const inspectionPresetRef = useRef("a1");',
  '  const inspectionPresetRef = useRef(resolvedInitialInspectionPreset);',
);
source = source.replace(
  '  const [inspectionPreset, setInspectionPreset] = useState("a1");',
  '  const [inspectionPreset, setInspectionPreset] = useState(resolvedInitialInspectionPreset);',
);

const legacyInitialEffect = `  useEffect(() => {
    if (!initialInspectionMode) return undefined;
    let cancelled = false;
    let frameId = 0;
    let attempts = 0;
    const activate = () => {
      if (cancelled) return;
      attempts += 1;
      if (simRef.current) {
        if (!inspectionRef.current) toggleInspectionDrive();
        return;
      }
      if (attempts < 600) frameId = window.requestAnimationFrame(activate);
    };
    frameId = window.requestAnimationFrame(activate);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [initialInspectionMode, toggleInspectionDrive]);`;
const launchPresetEffect = `  useEffect(() => {
    if (!initialInspectionMode) return undefined;
    let cancelled = false;
    let frameId = 0;
    let attempts = 0;
    const activate = () => {
      if (cancelled) return;
      attempts += 1;
      if (simRef.current) {
        if (!inspectionRef.current) toggleInspectionDrive();
        moveInspectionToPreset(resolvedInitialInspectionPreset);
        const canvas = simRef.current.renderer?.domElement;
        if (canvas) {
          canvas.dataset.initialInspectionPresetAuthority = "${INITIAL_PRESET_AUTHORITY}";
          canvas.dataset.a1EvidenceSubview = resolvedInitialInspectionPreset === "a1Connection"
            ? "terminal-joint"
            : "full-assembly";
          canvas.dataset.initialInspectionSubviewAuthority = "${INITIAL_SUBVIEW_AUTHORITY}";
        }
        return;
      }
      if (attempts < 600) frameId = window.requestAnimationFrame(activate);
    };
    frameId = window.requestAnimationFrame(activate);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [initialInspectionMode, moveInspectionToPreset, resolvedInitialInspectionPreset, toggleInspectionDrive]);`;
const existingLaunchPresetEffect = /  useEffect\(\(\) => \{\n    if \(!initialInspectionMode\) return undefined;[\s\S]*?initialInspectionMode, moveInspectionToPreset, resolvedInitialInspectionPreset, toggleInspectionDrive\]\);/;
if (existingLaunchPresetEffect.test(source)) {
  source = source.replace(existingLaunchPresetEffect, launchPresetEffect);
} else if (!source.includes(INITIAL_PRESET_AUTHORITY) || !source.includes("moveInspectionToPreset(resolvedInitialInspectionPreset);")) {
  if (!source.includes(legacyInitialEffect)) {
    throw new Error(`${trainerPath}: launch-time inspection effect anchor is missing`);
  }
  source = source.replace(legacyInitialEffect, launchPresetEffect);
}

// The earlier inspection-control stage runs against a freshly regenerated
// trainer, before INSPECTION_PRESETS/moveInspectionToPreset exist, so it exposes
// a temporary self-contained bridge. At this final camera stage every real
// preset exists. Replace the temporary bridge completely so browser evidence
// uses the same callback/state/camera definitions as the visible app control.
const temporaryBridgePattern = /  useEffect\(\(\) => \{\n    window\.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__ = \(presetId\) => \{[\s\S]*?visual-evidence-source-gate-presets-v8[\s\S]*?\n    return \(\) => \{ delete window\.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__; \};\n  \}, \[\]\);/;
const finalBridge = `  // ${VISUAL_BRIDGE_AUTHORITY}\n  useEffect(() => {\n    window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__ = (presetId) => {\n      if (!Object.prototype.hasOwnProperty.call(INSPECTION_PRESETS, presetId)) return null;\n      moveInspectionToPreset(presetId);\n      return presetId;\n    };\n    return () => { delete window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__; };\n  }, [moveInspectionToPreset]);`;
if (temporaryBridgePattern.test(source)) {
  source = source.replace(temporaryBridgePattern, finalBridge);
} else if (!source.includes(VISUAL_BRIDGE_AUTHORITY)) {
  const advanceAnchor = "  const advance = useCallback(() => {";
  if (!source.includes(advanceAnchor) || !source.includes("const moveInspectionToPreset = useCallback")) {
    throw new Error(`${trainerPath}: final visual bridge cannot resolve the real inspection callback/advance anchor`);
  }
  source = source.replace(advanceAnchor, `${finalBridge}\n\n${advanceAnchor}`);
}

for (const token of [
  exactPreset,
  "preset.cameraAuthority || (preset.cameraPosition",
  `"${A1_CAMERA_AUTHORITY}"`,
  CANONICAL_ROUTE_AUTHORITY,
  VISUAL_BRIDGE_AUTHORITY,
  "moveInspectionToPreset(presetId)",
  "}, [moveInspectionToPreset]);",
  INITIAL_PRESET_AUTHORITY,
  INITIAL_SUBVIEW_AUTHORITY,
  'initialInspectionPreset = "a1",',
  "const resolvedInitialInspectionPreset =",
  "moveInspectionToPreset(resolvedInitialInspectionPreset);",
  'resolvedInitialInspectionPreset === "a1Connection"',
  'canvas.dataset.a1EvidenceSubview =',
  '"terminal-joint"',
  "initialInspectionMode, moveInspectionToPreset, resolvedInitialInspectionPreset, toggleInspectionDrive",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: final inspection camera preparation is missing ${token}`);
}
for (const forbidden of [
  'cameraPosition: Object.freeze([184.0, 16.5, -52.0])',
  'cameraTarget: Object.freeze([218.45, 4.2, -86.52])',
  'cameraAuthority: "wide-diagonal-a14-exact-static-fleet-v1"',
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: obsolete empty-pavement A14 camera remains: ${forbidden}`);
}
if (source.includes("visual-evidence-source-gate-presets-v8")) {
  throw new Error(`${trainerPath}: temporary hard-coded visual evidence presets survived final camera preparation`);
}

fs.writeFileSync(trainerPath, source, "utf8");
// This stage is still inside prepare:terminal4-runtime, before the later A1
// grounding/readiness migrations. Enforce only the common source coordinate
// registration here. The photo-registered Rotunda finalizer deliberately runs
// later, immediately before Vite bundles the fully migrated production runtime.
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?terminal4-registration=${Date.now()}`);
console.log("Prepared the final A1 terminal-joint subview, chase-framed A14 fleet view, launch-time evidence preset and exact Terminal 4 source-coordinate registration. Final A1 Rotunda/wall placement remains deferred until after the complete grounding/readiness migration stack.");
