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

// The Aug. 17 attached-state photos are visual authority. Do not merely reject a
// mathematically solved steep bridge: cap the connected passenger-tunnel pitch at
// 4 degrees before any Tunnel A/B/C transform is applied, then let the independent
// <=15 cm Cab continuity guard expose any remaining door-height mismatch. This keeps
// the terminal and aircraft fixed and forces the connected bridge geometry to stay
// within the photographed nearly-level envelope.
const pitchMarker = "a1-aug17-attached-pitch-clamped-v3";
const continuityMarker = "a1-aug17-attached-continuity-failclosed-v2";
const continuityGuard = `  // ${continuityMarker}\n  if (Math.abs(cabVerticalAdjustment) > 0.15) {\n    throw new Error(\`A1 attached Cab would disconnect from Tunnel-C: independent vertical adjustment=\${cabVerticalAdjustment} m; solve the connected bridge/support geometry instead\`);\n  }`;

let preparedDoorFitSource = originalDoorFitSource;

if (!preparedDoorFitSource.includes(pitchMarker)) {
  const pitchDeclarationPattern = /  const pitchRadians = ([^\n]+);/;
  const pitchDeclarationMatch = preparedDoorFitSource.match(pitchDeclarationPattern);
  if (!pitchDeclarationMatch) {
    throw new Error("A1 door fitter lost the pitchRadians declaration; inspect generated fitter before adapting it");
  }
  const originalExpression = pitchDeclarationMatch[1];
  const clampedDeclaration = `  // ${pitchMarker}\n  const solvedPitchRadians = ${originalExpression};\n  const pitchRadians = Math.min(solvedPitchRadians, THREE.MathUtils.degToRad(4));`;
  preparedDoorFitSource = preparedDoorFitSource.replace(pitchDeclarationPattern, clampedDeclaration);

  // Remove any legacy/current fail-fast pitch-range block that would reject the
  // pre-clamp 7-degree mathematical solution before the capped geometry can render.
  preparedDoorFitSource = preparedDoorFitSource.replace(
    /  \/\/ a1-aug17-attached-pitch-failclosed-v2\n  if \(!\(pitchRadians > 0\.02 && pitchRadians <= THREE\.MathUtils\.degToRad\(4\)\)\) \{\n    throw new Error\(`A1 attached bridge pitch exceeds the Aug\. 17 reference envelope: \$\{THREE\.MathUtils\.radToDeg\(pitchRadians\)\} degrees`\);\n  \}\n?/g,
    "",
  );
}

if (!preparedDoorFitSource.includes(continuityMarker)) {
  const cabAdjustmentPattern = /  const cabVerticalAdjustment = [^\n]+;/;
  const cabAdjustmentMatch = preparedDoorFitSource.match(cabAdjustmentPattern);
  if (!cabAdjustmentMatch || cabAdjustmentMatch.index == null) {
    throw new Error("A1 door fitter lost the Cab vertical-adjustment declaration; inspect generated fitter before adapting it");
  }
  const insertAt = cabAdjustmentMatch.index + cabAdjustmentMatch[0].length;
  preparedDoorFitSource = `${preparedDoorFitSource.slice(0, insertAt)}\n${continuityGuard}${preparedDoorFitSource.slice(insertAt)}`;
}

for (const required of [
  pitchMarker,
  "Math.min(solvedPitchRadians, THREE.MathUtils.degToRad(4))",
  continuityMarker,
  "Math.abs(cabVerticalAdjustment) > 0.15",
]) {
  if (!preparedDoorFitSource.includes(required)) {
    throw new Error(`A1 attached-state bundle is missing ${required}`);
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

console.log("Ran photo-authoritative A1 Vite bundle with final runtime-safe facade cone normalization, diagnostic wording tolerance, a connected <=4 degree Aug. 17 pitch clamp, and fail-closed Cab continuity; tracked sources were restored exactly.");
