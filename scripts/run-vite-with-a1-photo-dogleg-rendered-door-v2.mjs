import { readFile, writeFile } from "node:fs/promises";

const wrapperPath = new URL("./run-vite-with-a1-photo-dogleg-rendered-door-v1.mjs", import.meta.url);
const doorFitPath = new URL("../src/environment/uploadedAirportJetwayA1DoorFitV11.js", import.meta.url);
const originalWrapperSource = await readFile(wrapperPath, "utf8");
const originalDoorFitSource = await readFile(doorFitPath, "utf8");

const strictDiagnosticBlock = `const readinessErrorAnchor = "connector=\${connectorVisibleLength}/\${connectorRibCount}, source=\${exactModelGuard.authority}";\nconst readinessErrorPhoto = "connector=\${connectorVisibleLength}/\${connectorRibCount}, photo=\${photoGeometryActive}/\${photoDoglegAuthority}/\${photoSupportAuthority}/\${photoSupportCount}, source=\${exactModelGuard.authority}";\nif (!preparedReadinessSource.includes(readinessErrorAnchor)) {\n  throw new Error("A1 readiness mismatch diagnostic anchor is missing");\n}\npreparedReadinessSource = preparedReadinessSource.split(readinessErrorAnchor).join(readinessErrorPhoto);`;

const tolerantDiagnosticBlock = `// a1-photo-readiness-diagnostic-wording-tolerant-v1\n// Diagnostic text is not geometry authority. Late readiness preparers legitimately\n// change the exact mismatch wording, so enrich the known form when present but do\n// not block Vite solely because an error-message string changed. The structural\n// dogleg/support/zero-extension/wall-length guards below remain fail-closed.\nconst readinessErrorAnchor = "connector=\${connectorVisibleLength}/\${connectorRibCount}, source=\${exactModelGuard.authority}";\nconst readinessErrorPhoto = "connector=\${connectorVisibleLength}/\${connectorRibCount}, photo=\${photoGeometryActive}/\${photoDoglegAuthority}/\${photoSupportAuthority}/\${photoSupportCount}, source=\${exactModelGuard.authority}";\nif (preparedReadinessSource.includes(readinessErrorAnchor)) {\n  preparedReadinessSource = preparedReadinessSource.split(readinessErrorAnchor).join(readinessErrorPhoto);\n}`;

if (!originalWrapperSource.includes(strictDiagnosticBlock)) {
  throw new Error("A1 photo wrapper no longer contains the expected strict diagnostic-only block; inspect before adapting it.");
}

const preparedWrapperSource = originalWrapperSource.replace(strictDiagnosticBlock, tolerantDiagnosticBlock);
if (!preparedWrapperSource.includes("a1-photo-readiness-diagnostic-wording-tolerant-v1")) {
  throw new Error("A1 photo wrapper diagnostic compatibility patch was not installed");
}

// The real Aug. 17 attached-state photos show a nearly level passenger bridge and
// a continuous Tunnel-C/Cab joint. The production chain can run this wrapper after
// another preparer has already installed either guard, so make this pass idempotent:
// preserve a current <=4 degree pitch guard and <=15 cm independent Cab correction,
// otherwise install them from the known legacy forms. Never fail just because the
// same fail-closed rule was installed earlier in the generation chain.
const pitchGuardBefore = "  if (!(pitchRadians > 0.02 && pitchRadians < 0.14)) {";
const pitchGuardAfter = "  if (!(pitchRadians > 0.02 && pitchRadians <= THREE.MathUtils.degToRad(4))) {";
const cabAdjustmentAnchor = "  const cabVerticalAdjustment = targetYInAnchor - cabAssembly.front.floorY;";
const continuityMarker = "a1-aug17-attached-continuity-failclosed-v1";
const cabAdjustmentGuard = `${cabAdjustmentAnchor}\n  // ${continuityMarker}\n  if (Math.abs(cabVerticalAdjustment) > 0.15) {\n    throw new Error(\`A1 attached Cab would disconnect from Tunnel-C: independent vertical adjustment=\${cabVerticalAdjustment} m; solve the connected bridge/support geometry instead\`);\n  }`;

let preparedDoorFitSource = originalDoorFitSource;
if (preparedDoorFitSource.includes(pitchGuardBefore)) {
  preparedDoorFitSource = preparedDoorFitSource.replace(pitchGuardBefore, pitchGuardAfter);
} else if (!preparedDoorFitSource.includes("pitchRadians <= THREE.MathUtils.degToRad(4)")) {
  throw new Error("A1 door fitter has neither the legacy nor current attached-state pitch guard; inspect generated fitter before adapting it");
}

if (!preparedDoorFitSource.includes(continuityMarker)) {
  if (!preparedDoorFitSource.includes(cabAdjustmentAnchor)) {
    throw new Error("A1 door fitter has neither the Cab vertical-adjustment anchor nor the current attached-continuity guard");
  }
  preparedDoorFitSource = preparedDoorFitSource.replace(cabAdjustmentAnchor, cabAdjustmentGuard);
}

for (const required of [
  "THREE.MathUtils.degToRad(4)",
  continuityMarker,
  "Math.abs(cabVerticalAdjustment) > 0.15",
]) {
  if (!preparedDoorFitSource.includes(required)) {
    throw new Error(`A1 attached-state fail-closed bundle is missing ${required}`);
  }
}

let runError;
let restorationError;
try {
  await writeFile(wrapperPath, preparedWrapperSource, "utf8");
  await writeFile(doorFitPath, preparedDoorFitSource, "utf8");
  await import(`./prepare-a1-facade-cone-final-runtime-v1.mjs?final-cone=${Date.now()}`);
  await import(`./run-vite-with-a1-photo-dogleg-rendered-door-v1.mjs?diagnostic-compat=${Date.now()}`);
} catch (error) {
  runError = error;
} finally {
  try {
    await writeFile(wrapperPath, originalWrapperSource, "utf8");
    await writeFile(doorFitPath, originalDoorFitSource, "utf8");
    const restored = await readFile(wrapperPath, "utf8");
    const restoredDoorFit = await readFile(doorFitPath, "utf8");
    if (restored !== originalWrapperSource) {
      throw new Error("A1 photo wrapper v2 failed to restore the tracked v1 wrapper byte-for-byte");
    }
    if (restoredDoorFit !== originalDoorFitSource) {
      throw new Error("A1 photo wrapper v2 failed to restore uploadedAirportJetwayA1DoorFitV11.js byte-for-byte");
    }
  } catch (error) {
    restorationError = error;
  }
}

if (runError && restorationError) {
  throw new AggregateError([runError, restorationError], "A1 photo bundle failed and protected source restoration also failed.");
}
if (restorationError) throw restorationError;
if (runError) throw runError;

console.log("Ran photo-authoritative A1 Vite bundle with final runtime-safe facade cone normalization, diagnostic wording tolerance, and Aug. 17 fail-closed attached-state continuity guards; tracked sources were restored exactly.");
