import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const A1_CAMERA_AUTHORITY = "fixed-terminal-wall-rotunda-joint-evidence-a1-v10";
const STATIC_FLEET_CAMERA_AUTHORITY = "source-gate-jetway-terminal-diagonal-fleet-v1";
const CANONICAL_ROUTE_AUTHORITY = "source-gate-apron-presets-with-exact-a1-terminal-joint-and-source-aimed-a14-b14-b15-v12";
const VISUAL_BRIDGE_AUTHORITY = "exact-runtime-inspection-callback-visual-evidence-bridge-v2";
let source = fs.readFileSync(trainerPath, "utf8");

const a14B14Pattern = /  a14: Object\.freeze\(\{[\s\S]*?\n  b14: Object\.freeze\(\{[^\n]+\}\),/;
const exactFleetPresets = `  // Fixed fleet-evidence cameras are aimed at the actual package-authored jetway positions,\n  // not at the inspection tug. A14 source jetway: 176.13/-56.39, parking: 203.78/-76.08.\n  // B14 source jetway: 164.41/180.73, parking: 200.87/159.42.\n  a14: Object.freeze({\n    id: "a14", label: "A concourse midpoint", x: 203.78, z: -76.08, yaw: 2.88,\n    cameraYaw: 2.19, cameraDistance: 32,\n    cameraPosition: Object.freeze([226.0, 16.0, -111.0]),\n    cameraTarget: Object.freeze([184.0, 4.0, -61.0]),\n    cameraAuthority: "${STATIC_FLEET_CAMERA_AUTHORITY}",\n  }),\n  b14: Object.freeze({\n    id: "b14", label: "B concourse midpoint", x: 200.87, z: 159.42, yaw: 2.8,\n    cameraYaw: 2.10, cameraDistance: 32,\n    cameraPosition: Object.freeze([226.0, 16.0, 132.0]),\n    cameraTarget: Object.freeze([173.0, 4.0, 181.0]),\n    cameraAuthority: "${STATIC_FLEET_CAMERA_AUTHORITY}",\n  }),`;
if (!a14B14Pattern.test(source)) {
  throw new Error(`${trainerPath}: A14/B14 inspection preset anchor is missing`);
}
source = source.replace(a14B14Pattern, exactFleetPresets);

source = source.replace(
  /source-gate-apron-presets-with-[^"\n]+-v\d+/g,
  CANONICAL_ROUTE_AUTHORITY,
);

if (!source.includes("preset.cameraAuthority || (preset.cameraPosition")) {
  source = source.replace(
    'canvas.dataset.inspectionCameraAuthority = preset.cameraPosition\n      ? "fixed-terminal-wall-rotunda-joint-evidence-a1-v10"\n      : "free-orbit-follow-tug";',
    'canvas.dataset.inspectionCameraAuthority = preset.cameraAuthority || (preset.cameraPosition\n      ? "fixed-terminal-wall-rotunda-joint-evidence-a1-v10"\n      : "free-orbit-follow-tug");',
  );
}

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
  'id: "a14", label: "A concourse midpoint"',
  'id: "b14", label: "B concourse midpoint"',
  'cameraPosition: Object.freeze([226.0, 16.0, -111.0])',
  'cameraTarget: Object.freeze([184.0, 4.0, -61.0])',
  'cameraPosition: Object.freeze([226.0, 16.0, 132.0])',
  'cameraTarget: Object.freeze([173.0, 4.0, 181.0])',
  `cameraAuthority: "${STATIC_FLEET_CAMERA_AUTHORITY}"`,
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
  'a14: Object.freeze({ id: "a14", label: "A concourse midpoint", x: 218.45, z: -86.52',
  'b14: Object.freeze({ id: "b14", label: "B concourse midpoint", x: 216.4, z: 150.35',
  'cameraAuthority: "wide-diagonal-a14-exact-static-fleet-v1"',
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: obsolete empty-pavement fleet camera remains: ${forbidden}`);
}
if (source.includes("visual-evidence-source-gate-presets-v8")) {
  throw new Error(`${trainerPath}: temporary hard-coded visual evidence presets survived final camera preparation`);
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?terminal4-registration=${Date.now()}`);
console.log("Prepared exact A1 terminal-joint evidence plus fixed A14/B14 fleet cameras aimed at the package-authored jetway/terminal positions instead of empty apron pavement.");
