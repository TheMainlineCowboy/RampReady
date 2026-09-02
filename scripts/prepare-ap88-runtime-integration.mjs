import { readFile, writeFile } from "node:fs/promises";

const target = new URL("../src/components/RampReadyStandupTrainerTerminal4.jsx", import.meta.url);
let source = await readFile(target, "utf8");

const legacyImport = 'import { installRuntimeEquipmentVisual, supportsRuntimeEquipmentVisual } from "../tug/runtimeEquipmentVisual.js";';
const ap88Import = 'import { installRuntimeEquipmentVisual, supportsRuntimeEquipmentVisual } from "../tug/ap88RuntimeVisual.js";';
if (!source.includes(legacyImport) && !source.includes(ap88Import)) throw new Error("Runtime equipment visual import anchor missing");
source = source.replace(legacyImport, ap88Import);

source = source.replace(
  'renderer.domElement.dataset.tugSource = equipmentId === "standup-tug" ? "loading" : "procedural-lektro";',
  'renderer.domElement.dataset.tugSource = "loading";\n    renderer.domElement.dataset.ap88RuntimeContract = equipmentId === "lektro-88" ? "r4-live-articulation" : "not-ap88";',
);

const sourceAssignment = '        renderer.domElement.dataset.tugSource = source;';
if (!source.includes(sourceAssignment)) throw new Error("Runtime tug source assignment anchor missing");
source = source.replace(
  sourceAssignment,
  `${sourceAssignment}\n        if (equipmentId === "lektro-88") {\n          renderer.domElement.dataset.operatorControls = "two-seats-one-steering-wheel";\n          renderer.domElement.dataset.ap88AssetSha256 = rig.root.userData.ap88ModelSha256 || "missing";\n          renderer.domElement.dataset.ap88AssetBytes = String(rig.root.userData.ap88ModelBytes || 0);\n          renderer.domElement.dataset.ap88Articulation = rig.root.userData.ap88Articulation || "missing";\n          renderer.domElement.dataset.ap88SeatLayout = rig.root.userData.ap88SeatLayout || "missing";\n        }`,
);

const liftAnchor = '      rig.setLiftProgress(lift);';
if (!source.includes(liftAnchor)) throw new Error("Lift runtime anchor missing");
source = source.replace(liftAnchor, `${liftAnchor}\n      rig.updateVisual?.(dt, now);`);

if (!source.includes("../tug/ap88RuntimeVisual.js")) throw new Error("AP88 runtime visual module was not installed");
if (!source.includes('dataset.ap88Articulation = rig.root.userData.ap88Articulation')) throw new Error("AP88 runtime evidence was not installed");
if (!source.includes("rig.updateVisual?.(dt, now)")) throw new Error("AP88 per-frame visual update was not installed");

await writeFile(target, source);
console.log("Prepared LEKTRO AP88 R4 live runtime integration in Terminal 4 trainer.");
