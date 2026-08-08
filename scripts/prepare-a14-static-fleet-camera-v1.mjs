import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const sourceRegistrationPath = "src/environment/uploadedAirportJetwayFleet.js";
const A1_CAMERA_AUTHORITY = "fixed-terminal-wall-rotunda-joint-evidence-a1-v10";
const CANONICAL_ROUTE_AUTHORITY = "source-gate-apron-presets-with-exact-a1-terminal-joint-subview-and-chase-a14-b14-b15-v11";
const VISUAL_BRIDGE_AUTHORITY = "exact-runtime-inspection-callback-visual-evidence-bridge-v2";
let source = fs.readFileSync(trainerPath, "utf8");

const a14Pattern = /  a14: Object\.freeze\(\{[\s\S]*?\n  \}\),\n  b14:/;
const exactPreset = '  a14: Object.freeze({ id: "a14", label: "A concourse midpoint", x: 218.45, z: -86.52, yaw: 2.88, cameraYaw: 2.19, cameraDistance: 32 }),\n  b14:';
if (!source.includes(exactPreset)) {
  if (!a14Pattern.test(source)) throw new Error(`${trainerPath}: A14 inspection preset anchor is missing`);
  source = source.replace(a14Pattern, exactPreset);
}

source = source.replace(
  /source-gate-apron-presets-with-[^"\n]+-a1-a14-b14-b15-v\d+/g,
  CANONICAL_ROUTE_AUTHORITY,
);

if (!source.includes("preset.cameraAuthority || (preset.cameraPosition")) {
  source = source.replace(
    'canvas.dataset.inspectionCameraAuthority = preset.cameraPosition\n      ? "fixed-terminal-wall-rotunda-joint-evidence-a1-v10"\n      : "free-orbit-follow-tug";',
    'canvas.dataset.inspectionCameraAuthority = preset.cameraAuthority || (preset.cameraPosition\n      ? "fixed-terminal-wall-rotunda-joint-evidence-a1-v10"\n      : "free-orbit-follow-tug");',
  );
}

// Earlier preparation stages may already install launch-time inspection state in
// slightly different generated forms. Do not require a particular comment,
// dependency ordering, or formatting here. The browser evidence uses the stable
// final bridge below and fail-closes on real canvas telemetry/render output.

const temporaryBridgePattern = /  useEffect\(\(\) => \{\n    window\.__RAMPREADY_VISUAL_EVIDENCE_ENABLE_INSPECTION__ = \(\) => \{[\s\S]*?visual-evidence-source-gate-presets-v8[\s\S]*?delete window\.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__;\n    \};\n  \}, \[\]\);/;
const legacyTemporaryBridgePattern = /  useEffect\(\(\) => \{\n    window\.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__ = \(presetId\) => \{[\s\S]*?visual-evidence-source-gate-presets-v8[\s\S]*?\n    return \(\) => \{ delete window\.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__; \};\n  \}, \[\]\);/;
const finalBridge = `  // ${VISUAL_BRIDGE_AUTHORITY}\n  useEffect(() => {\n    window.__RAMPREADY_VISUAL_EVIDENCE_ENABLE_INSPECTION__ = () => {\n      if (!inspectionRef.current) toggleInspectionDrive();\n      return "active";\n    };\n    window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__ = (presetId) => {\n      if (!Object.prototype.hasOwnProperty.call(INSPECTION_PRESETS, presetId)) return null;\n      moveInspectionToPreset(presetId);\n      return presetId;\n    };\n    return () => {\n      delete window.__RAMPREADY_VISUAL_EVIDENCE_ENABLE_INSPECTION__;\n      delete window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__;\n    };\n  }, [moveInspectionToPreset, toggleInspectionDrive]);`;
if (temporaryBridgePattern.test(source)) {
  source = source.replace(temporaryBridgePattern, finalBridge);
} else if (legacyTemporaryBridgePattern.test(source)) {
  source = source.replace(legacyTemporaryBridgePattern, finalBridge);
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
  "window.__RAMPREADY_VISUAL_EVIDENCE_ENABLE_INSPECTION__",
  "moveInspectionToPreset(presetId)",
  "}, [moveInspectionToPreset, toggleInspectionDrive]);",
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
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?terminal4-registration=${Date.now()}`);
console.log("Prepared the final A1 terminal-joint evidence bridge and A14 fleet view against generated runtime semantics; final A1 Rotunda/wall placement remains deferred until the complete grounding/readiness migration stack.");