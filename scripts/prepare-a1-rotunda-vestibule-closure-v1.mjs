import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const INTERIOR_AUTHORITY = "same-day-a1-photo-closed-rotunda-collar-vestibule-v3";
const ROTUNDA_DOOR_RECESS_METERS = 0.42;
const ROTUNDA_DOOR_PANEL_DEPTH_METERS = 0.18;

if (!source.includes("UploadedAirportJetwayA1RotundaVestibuleClosedDoorPanel")) {
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

  const vestibuleYaw = Math.atan2(openingDirection.x, openingDirection.z);
  const vestibuleSideX = Math.cos(vestibuleYaw);
  const vestibuleSideZ = -Math.sin(vestibuleYaw);
  const visibleVestibuleLength = Math.max(
    1.2,
    terminalDistance - rotundaOpening.collarRadius,
  );

  // The fresh exact-head render proved that the open passenger passage inside
  // the Rotunda collar still read from the apron as a giant black rectangular
  // hole. Put the actual closed terminal vestibule doors just inside the collar
  // while leaving the supplied Rotunda shell and the 2.4 m exterior vestibule
  // visible. No Rotunda/Tunnel/Cab source node is changed or covered externally.
  const rotundaDoorDistance = Math.min(
    ROTUNDA_DOOR_RECESS_METERS,
    Math.max(0.3, visibleVestibuleLength * 0.2),
  );
  const rotundaDoorX = collarPoint.x + openingDirection.x * rotundaDoorDistance;
  const rotundaDoorZ = collarPoint.z + openingDirection.z * rotundaDoorDistance;
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1RotundaVestibuleClosedDoorPanel",
    [width - 0.16, height - 0.16, ROTUNDA_DOOR_PANEL_DEPTH_METERS],
    [rotundaDoorX, collarPoint.y, rotundaDoorZ],
    vestibuleYaw,
    false,
  );

  const rotundaDoorApronFaceOffset = ROTUNDA_DOOR_PANEL_DEPTH_METERS * 0.5 + 0.018;
  for (const side of [-1, 1]) {
    addBox(
      THREE,
      connector,
      materials.interior,
      "UploadedAirportJetwayA1RotundaVestibuleDoorWindow_" + side,
      [0.42, 0.58, 0.025],
      [
        rotundaDoorX + vestibuleSideX * side * 0.45 - openingDirection.x * rotundaDoorApronFaceOffset,
        collarPoint.y + 0.24,
        rotundaDoorZ + vestibuleSideZ * side * 0.45 - openingDirection.z * rotundaDoorApronFaceOffset,
      ],
      vestibuleYaw,
      false,
    );
  }
  addBox(
    THREE,
    connector,
    materials.rib,
    "UploadedAirportJetwayA1RotundaVestibuleDoorCenterSeam",
    [0.04, height - 0.42, 0.03],
    [
      rotundaDoorX - openingDirection.x * rotundaDoorApronFaceOffset,
      collarPoint.y - 0.04,
      rotundaDoorZ - openingDirection.z * rotundaDoorApronFaceOffset,
    ],
    vestibuleYaw,
    false,
  );
  addBox(
    THREE,
    connector,
    materials.rib,
    "UploadedAirportJetwayA1RotundaVestibuleDoorThreshold",
    [width - 0.28, 0.12, 0.05],
    [
      rotundaDoorX - openingDirection.x * rotundaDoorApronFaceOffset,
      collarPoint.y - height * 0.5 + 0.16,
      rotundaDoorZ - openingDirection.z * rotundaDoorApronFaceOffset,
    ],
    vestibuleYaw,
    false,
  );

  // Retain a second opaque wall near the terminal end. This prevents any view
  // through the short vestibule from the terminal side without fabricating a
  // long corridor or moving the terminal wall connection.
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

if (!source.includes("connector.userData.rotundaVestibuleDoorRecessMeters")) {
  const evidenceAnchor = "  connector.userData.noGeneratedGlassCorridor = true;";
  if (!source.includes(evidenceAnchor)) {
    throw new Error(`${installationPath}: connector evidence anchor is missing`);
  }
  source = source.replace(
    evidenceAnchor,
    `${evidenceAnchor}
  connector.userData.apronFacingRotundaOpeningClosed = true;
  connector.userData.rotundaVestibuleDoorRecessMeters = ${ROTUNDA_DOOR_RECESS_METERS};
  connector.userData.rotundaVestibuleInteriorAuthority = "${INTERIOR_AUTHORITY}";`,
  );
} else {
  source = source.replace(
    /connector\.userData\.rotundaVestibuleInteriorAuthority = "[^"]+";/,
    `connector.userData.rotundaVestibuleInteriorAuthority = "${INTERIOR_AUTHORITY}";`,
  );
}

for (const token of [
  "UploadedAirportJetwayA1RotundaVestibuleClosedDoorPanel",
  "UploadedAirportJetwayA1RotundaVestibuleDoorWindow_",
  "UploadedAirportJetwayA1RotundaVestibuleDoorCenterSeam",
  "UploadedAirportJetwayA1RotundaVestibuleDoorThreshold",
  "UploadedAirportJetwayA1VestibuleInteriorBackWall",
  "connector.userData.apronFacingRotundaOpeningClosed = true",
  `connector.userData.rotundaVestibuleDoorRecessMeters = ${ROTUNDA_DOOR_RECESS_METERS}`,
  `rotundaVestibuleInteriorAuthority = "${INTERIOR_AUTHORITY}"`,
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: A1 closed Rotunda vestibule output is missing ${token}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Closed the apron-visible A1 Rotunda passage with recessed white vestibule doors while preserving the supplied Rotunda exterior, the short 2.4 m terminal vestibule, the exact authored bridge hierarchy and zero isolated-node rotations.");
