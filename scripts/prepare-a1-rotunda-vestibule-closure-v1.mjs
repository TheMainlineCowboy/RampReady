import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const CLOSURE_AUTHORITY = "same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1";

if (!source.includes("UploadedAirportJetwayA1RotundaVestibuleClosurePanel")) {
  const bellowsCallPattern = /  addBellowsRing\(\n    THREE,\n    connector,\n    materials,\n    collarPoint\.clone\(\)\.addScaledVector\(openingDirection, 0\.08\),\n    openingDirection,\n    width,\n    height,\n  \);\n\n  const transitionLength/;
  if (!bellowsCallPattern.test(source)) {
    throw new Error(`${installationPath}: Rotunda bellows insertion anchor is missing`);
  }
  source = source.replace(
    bellowsCallPattern,
    `  addBellowsRing(
    THREE,
    connector,
    materials,
    collarPoint.clone().addScaledVector(openingDirection, 0.08),
    openingDirection,
    width,
    height,
  );

  // The flexible collar is a narrow dark border in the same-day A1 photos,
  // not an open black aperture. Close its center with the solid white
  // vestibule bulkhead while preserving every supplied GLB node unchanged.
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
    [width - 0.3, height - 0.3, 0.12],
    [
      collarPoint.x + openingDirection.x * 0.24,
      collarPoint.y,
      collarPoint.z + openingDirection.z * 0.24,
    ],
    Math.atan2(openingDirection.x, openingDirection.z),
    false,
  );

  const transitionLength`,
  );
}

if (!source.includes("connector.userData.apronFacingRotundaOpeningClosed")) {
  const evidenceAnchor = "  connector.userData.noGeneratedGlassCorridor = true;";
  if (!source.includes(evidenceAnchor)) {
    throw new Error(`${installationPath}: connector evidence anchor is missing`);
  }
  source = source.replace(
    evidenceAnchor,
    `${evidenceAnchor}
  connector.userData.apronFacingRotundaOpeningClosed = true;
  connector.userData.rotundaVestibuleClosureAuthority = "${CLOSURE_AUTHORITY}";`,
  );
}

for (const token of [
  "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
  "connector.userData.apronFacingRotundaOpeningClosed = true",
  `rotundaVestibuleClosureAuthority = "${CLOSURE_AUTHORITY}"`,
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: A1 Rotunda closure output is missing ${token}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
await import(`./prepare-a1-visual-acceptance-evidence-v1.mjs?visual-acceptance=${Date.now()}`);
console.log("Closed the A1 Rotunda-side vestibule with a solid photo-matched white bulkhead, published compact continuous visual evidence, and preserved every supplied jetway child transform.");
