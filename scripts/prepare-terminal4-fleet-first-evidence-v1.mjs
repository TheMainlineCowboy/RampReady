import fs from "node:fs";

const verifierPath = "scripts/verify-terminal4-fleet-visual.cjs";
const marker = "terminal4-fleet-views-before-a1-close-evidence-v1";
let source = fs.readFileSync(verifierPath, "utf8");

if (!source.includes("terminal4-jetway-load-failfast-v1")) {
  throw new Error(`${verifierPath}: fail-fast readiness patch must run before fleet-first evidence ordering`);
}

if (!source.includes(marker)) {
  const readyAnchor = `  checkpoint('fleet-ready', {
    loadState: fleetReadyDataset.terminal4UploadedJetwayLoadState,
    selectedA1Material: fleetReadyDataset.terminal4UploadedJetwayA1SelectedMaterialReference || null,
  });`;
  if (!source.includes(readyAnchor)) {
    throw new Error(`${verifierPath}: patched fleet-ready checkpoint is missing`);
  }

  const fleetLoop = `  for (const [preset, label, filename, cameraView] of fleetViews) {
    await selectByLabel(page, 'Inspection location', label);
    await waitForPreset(page, preset);
    await selectByValue(page, 'Camera view', cameraView);
    await page.waitForTimeout(900);
    captures[filename] = await capture(page, filename);
    checkpoint(\`${'${preset}'}-complete\`, { filename, bytes: captures[filename] });
  }`;

  const earlyFleetBlock = `${readyAnchor}

  // ${marker}
  // Fleet geometry is the primary acceptance target for this workflow. Capture
  // the wide A/B views as soon as all 58 exact jetways are ready so a separate
  // A1 close-camera handshake cannot prevent fleet evidence from being written.
  const captures = {};
${fleetLoop}
  checkpoint('fleet-views-complete-before-a1-close', { captures: Object.keys(captures) });`;
  source = source.replace(readyAnchor, earlyFleetBlock);

  const lateCaptureDeclaration = `  const captures = {};
  await selectA1Subview(page, 'terminal-joint');`;
  if (!source.includes(lateCaptureDeclaration)) {
    throw new Error(`${verifierPath}: late capture declaration is missing`);
  }
  source = source.replace(
    lateCaptureDeclaration,
    `  await selectA1Subview(page, 'terminal-joint');`,
  );

  const firstLoopIndex = source.indexOf(fleetLoop);
  const secondLoopIndex = source.indexOf(fleetLoop, firstLoopIndex + fleetLoop.length);
  if (firstLoopIndex < 0 || secondLoopIndex < 0) {
    throw new Error(`${verifierPath}: expected both early and retired late fleet loops before cleanup`);
  }
  source = `${source.slice(0, secondLoopIndex)}${source.slice(secondLoopIndex + fleetLoop.length)}`;
}

for (const required of [
  marker,
  "fleet-views-complete-before-a1-close",
  "const captures = {};",
  "a-concourse-fleet.png",
  "b-concourse-fleet.png",
  "b15-terminal-jetways.png",
]) {
  if (!source.includes(required)) throw new Error(`${verifierPath}: fleet-first evidence ordering is missing ${required}`);
}

const fleetLoopOccurrences = (source.match(/for \(const \[preset, label, filename, cameraView\] of fleetViews\)/g) || []).length;
if (fleetLoopOccurrences !== 1) {
  throw new Error(`${verifierPath}: fleet views must be captured exactly once, found ${fleetLoopOccurrences}`);
}

fs.writeFileSync(verifierPath, source, "utf8");
console.log("Prepared Terminal 4 visual evidence to capture A14/B14/B15 fleet views immediately after 58-jetway readiness, before any A1 close-camera wait; geometry and acceptance thresholds are unchanged.");
