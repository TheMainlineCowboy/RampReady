import fs from "node:fs";

function replaceRequired(source, oldText, newText, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(oldText)) throw new Error(`Missing ${label} anchor`);
  return source.replace(oldText, newText);
}

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(path, "utf8");

source = replaceRequired(
  source,
  'import "./mobile-runtime-recovery.css";',
  'import "./mobile-runtime-recovery.css";\nimport "./inspection-compact-v30.css";',
  'import "./inspection-compact-v30.css";',
  "compact inspection HUD import",
);

source = replaceRequired(
  source,
  `export default function RampReadyStandupTrainer({
  equipmentId = "lektro-88",
  onChangeEquipment,`,
  `export default function RampReadyStandupTrainer({
  equipmentId = "lektro-88",
  initialInspectionMode = false,
  onChangeEquipment,`,
  "initialInspectionMode = false,",
  "initial inspection prop",
);

const toggleEnd = `    setMessage(next
      ? "Free-drive airport inspection active. Use W/S or the power slider, A/D to steer, and the camera views to inspect the entire airport."
      : "Training mode restored. Complete the equipment check, then approach at idle speed.");
  }, []);

  const advance = useCallback(() => {`;
const toggleReplacement = `    setMessage(next
      ? "Free-drive airport inspection active. Use W/S or the power slider, A/D to steer, and the camera views to inspect the entire airport."
      : "Training mode restored. Complete the equipment check, then approach at idle speed.");
  }, []);

  useEffect(() => {
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
  }, [initialInspectionMode, toggleInspectionDrive]);

  const advance = useCallback(() => {`;
source = replaceRequired(
  source,
  toggleEnd,
  toggleReplacement,
  "attempts < 600) frameId = window.requestAnimationFrame(activate);",
  "direct inspection activation effect",
);

source = replaceRequired(
  source,
  '    renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "loading";',
  '    renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "loading";\n    renderer.domElement.dataset.terminal4SourceClosedBayMaterialCount = "loading";\n    renderer.domElement.dataset.terminal4SourceFacadeOpenCellCount = "loading";\n    renderer.domElement.dataset.terminal4SourceFacadeClosedCellCount = "loading";\n    renderer.domElement.dataset.terminal4SourceFacadeVariantMaterialCount = "loading";',
  'dataset.terminal4SourceFacadeVariantMaterialCount = "loading"',
  "facade variation loading evidence",
);

source = replaceRequired(
  source,
  "        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = String(environment.userData.authoredTerminal4SourceCutoutMaterialCount ?? 0);",
  "        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = String(environment.userData.authoredTerminal4SourceCutoutMaterialCount ?? 0);\n        renderer.domElement.dataset.terminal4SourceClosedBayMaterialCount = String(environment.userData.authoredTerminal4SourceClosedBayMaterialCount ?? 0);\n        renderer.domElement.dataset.terminal4SourceFacadeOpenCellCount = String(environment.userData.authoredTerminal4SourceFacadeOpenCellCount ?? 0);\n        renderer.domElement.dataset.terminal4SourceFacadeClosedCellCount = String(environment.userData.authoredTerminal4SourceFacadeClosedCellCount ?? 0);\n        renderer.domElement.dataset.terminal4SourceFacadeVariantMaterialCount = String(environment.userData.authoredTerminal4SourceFacadeVariantMaterialCount ?? 0);",
  "dataset.terminal4SourceFacadeVariantMaterialCount = String(environment.userData.authoredTerminal4SourceFacadeVariantMaterialCount",
  "facade variation ready evidence",
);

source = replaceRequired(
  source,
  '        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "load-error";',
  '        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "load-error";\n        renderer.domElement.dataset.terminal4SourceClosedBayMaterialCount = "load-error";\n        renderer.domElement.dataset.terminal4SourceFacadeOpenCellCount = "load-error";\n        renderer.domElement.dataset.terminal4SourceFacadeClosedCellCount = "load-error";\n        renderer.domElement.dataset.terminal4SourceFacadeVariantMaterialCount = "load-error";',
  'dataset.terminal4SourceFacadeVariantMaterialCount = "load-error"',
  "facade variation error evidence",
);

for (const token of [
  'import "./inspection-compact-v30.css";',
  "initialInspectionMode = false,",
  "attempts < 600) frameId = window.requestAnimationFrame(activate);",
  'dataset.terminal4SourceFacadeVariantMaterialCount = "loading"',
  "dataset.terminal4SourceFacadeOpenCellCount = String(environment.userData.authoredTerminal4SourceFacadeOpenCellCount",
  "dataset.terminal4SourceFacadeClosedCellCount = String(environment.userData.authoredTerminal4SourceFacadeClosedCellCount",
  "dataset.terminal4SourceFacadeVariantMaterialCount = String(environment.userData.authoredTerminal4SourceFacadeVariantMaterialCount",
]) {
  if (!source.includes(token)) throw new Error(`Direct inspection preparation missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared direct tug inspection v32 without DOM polling, with compact controls and package-native varied facade evidence.");
