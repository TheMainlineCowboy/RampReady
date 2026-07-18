import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractUrl = new URL("../docs/assets/lektro-scan-conversion-contract.json", import.meta.url);
const contract = JSON.parse(await readFile(contractUrl, "utf8"));

assert.equal(contract.schemaVersion, 1);
assert.equal(contract.asset, "KIRI Engine rough Lektro pushback scan");
assert.equal(contract.status, "reference-only");
assert.equal(contract.runtimeUseAllowed, false);
assert.equal(contract.coordinateContract.upAxis, "+Y");
assert.equal(contract.coordinateContract.forwardAxis, "unresolved");
assert.equal(contract.coordinateContract.units, "meters after verified physical calibration");
assert.equal(contract.coordinateContract.provisionalScaleAllowedForInspectionOnly, true);

const stageIds = contract.requiredStages.map((stage) => stage.id);
assert.deepEqual(stageIds, [
  "inventory",
  "isolate-tug",
  "orient-and-scale",
  "repair-and-retopologize",
  "materials",
  "convert",
  "simulator-fit",
]);
assert.equal(contract.requiredStages[0].state, "complete");
assert.equal(contract.requiredStages[1].state, "blocked-on-source-files");
assert.ok(contract.requiredStages.every((stage) => Array.isArray(stage.outputs) && stage.outputs.length > 0));
assert.ok(contract.requiredStages.slice(1).every((stage) => Array.isArray(stage.acceptance) && stage.acceptance.length > 0));

assert.ok(contract.budgets.mobileTrianglesMaximum <= 35000);
assert.ok(contract.budgets.vrTrianglesMaximum <= 55000);
assert.ok(contract.budgets.mobileTextureMaximum <= 2048);
assert.ok(contract.budgets.drawCallsMaximum <= 8);

assert.ok(contract.releaseGates.includes("scale and orientation have documentary evidence"));
assert.ok(contract.releaseGates.some((gate) => gate.includes("nose-gear capture origin")));
assert.ok(contract.releaseGates.some((gate) => gate.includes("browser runtime loads the GLB")));

console.log("Verified Lektro scan conversion contract and runtime-use gate.");
