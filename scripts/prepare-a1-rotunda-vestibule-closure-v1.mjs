import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const INTERIOR_AUTHORITY = "same-day-a1-photo-recessed-rotunda-vestibule-interior-v2";

if (!source.includes("UploadedAirportJetwayA1VestibuleInteriorBackWall")) {
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

  // The same-day A1 photos show a narrow flexible collar opening into an
  // enclosed white vestibule—not an empty aperture and not a flat plug at the
  // Rotunda face. Recess the terminal doors near the far end of the visible
  // 2.4 m span so the exterior view retains real corridor depth.
  const vestibuleYaw = Math.atan2(openingDirection.x, openingDirection.z);
  const vestibuleSideX = Math.cos(vestibuleYaw);
  const vestibuleSideZ = -Math.sin(vestibuleYaw);
  const visibleVestibuleLength = Math.max(
    1.2,
    terminalDistance - rotundaOpening.collarRadius,
  );
  const interiorBackWallDistance = Math.max(
    1.1,
    visibleVestibuleLength - 0.34,
  );
  const interiorBackWallX = collarPoint.x + openingDirection.x * interiorBackWallDistance;
  const interiorBackWallZ = collarPoint.z + openingDirection.z * interiorBackWallDistance;
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1VestibuleInteriorBackWall",
    [width - 0.28, height - 0.28, 0.1],
    [interiorBackWallX, collarPoint.y, interiorBackWallZ],
    vestibuleYaw,
    false,
  );

  // Two recessed door windows and a center seam make this read as the actual
  // enclosed passenger vestibule instead of a white blank wall.
  for (const side of [-1, 1]) {
    addBox(
      THREE,
      connector,
      materials.interior,
      "UploadedAirportJetwayA1VestibuleDoorWindow_" + side,
      [0.48, 0.78, 0.028],
      [
        interiorBackWallX + vestibuleSideX * side * 0.47 - openingDirection.x * 0.058,
        collarPoint.y + 0.26,
        interiorBackWallZ + vestibuleSideZ * side * 0.47 - openingDirection.z * 0.058,
      ],
      vestibuleYaw,
      false,
    );
  }
  addBox(
    THREE,
    connector,
    materials.interior,
    "UploadedAirportJetwayA1VestibuleDoorCenterSeam",
    [0.045, height - 0.48, 0.03],
    [
      interiorBackWallX - openingDirection.x * 0.06,
      collarPoint.y - 0.04,
      interiorBackWallZ - openingDirection.z * 0.06,
    ],
    vestibuleYaw,
    false,
  );
  addBox(
    THREE,
    connector,
    materials.rib,
    "UploadedAirportJetwayA1VestibuleInteriorCeilingLight",
    [1.18, 0.12, 0.035],
    [
      interiorBackWallX - openingDirection.x * 0.24,
      collarPoint.y + height * 0.5 - 0.24,
      interiorBackWallZ - openingDirection.z * 0.24,
    ],
    vestibuleYaw,
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
  connector.userData.rotundaVestibuleInteriorAuthority = "${INTERIOR_AUTHORITY}";`,
  );
}

for (const token of [
  "UploadedAirportJetwayA1VestibuleInteriorBackWall",
  "UploadedAirportJetwayA1VestibuleDoorWindow_",
  "UploadedAirportJetwayA1VestibuleDoorCenterSeam",
  "UploadedAirportJetwayA1VestibuleInteriorCeilingLight",
  "connector.userData.apronFacingRotundaOpeningClosed = true",
  `rotundaVestibuleInteriorAuthority = "${INTERIOR_AUTHORITY}"`,
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: A1 recessed vestibule output is missing ${token}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Recessed the A1 vestibule terminal doors behind the tight flexible Rotunda collar, preserving visible corridor depth while eliminating the giant open aperture; the supplied jetway hierarchy remains untouched.");
