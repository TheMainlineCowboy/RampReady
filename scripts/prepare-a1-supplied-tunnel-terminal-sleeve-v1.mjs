import fs from "node:fs";

await import(`./prepare-a1-remove-legacy-fixed-walkway-v1.mjs?legacy-walkway=${Date.now()}`);

const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-terminal-sleeve-opaque-source-matched-recessed-panel-joints-v5";
let source = fs.readFileSync(elbowPath, "utf8");

if (!source.includes(marker)) {
  const oldMaterials = `function createMaterials(THREE) {
  return {
    shell: new THREE.MeshStandardMaterial({
      name: "A1 fixed-wall compact terminal-side shell",
      color: 0xe1e2df,
      roughness: 0.78,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    rib: new THREE.MeshStandardMaterial({
      name: "A1 fixed-wall terminal-side panel seams",
      color: 0xd9dbd8,
      roughness: 0.84,
      metalness: 0.06,
      side: THREE.DoubleSide,
    }),
    bellows: new THREE.MeshStandardMaterial({
      name: "A1 fixed-wall Rotunda collar bellows",
      color: 0x303336,
      roughness: 0.95,
      metalness: 0.01,
      side: THREE.DoubleSide,
    }),
  };
}`;
  const newMaterials = `// ${marker}
function createMaterials(THREE, tunnelA) {
  // Keep the generated fixed sleeve visually consistent with Tunnel A without
  // copying Tunnel A's authored texture atlas onto unrelated BoxGeometry UVs.
  // The measured Tunnel A cross-section is preserved below; this synthetic
  // terminal section uses a clean opaque source-matched PBR shell instead.
  const shell = new THREE.MeshStandardMaterial({
    name: "A1 fixed terminal sleeve - opaque source-matched shell",
    color: 0xe1e2df,
    roughness: 0.78,
    metalness: 0.08,
    side: THREE.DoubleSide,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    depthTest: true,
  });
  shell.needsUpdate = true;

  return {
    shell,
    shellSourceMaterialName: "source-matched-opaque-pbr-no-atlas",
    rib: new THREE.MeshStandardMaterial({
      name: "A1 fixed terminal sleeve - recessed joint backing",
      color: 0x565c5e,
      roughness: 0.96,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    bellows: new THREE.MeshStandardMaterial({
      name: "A1 fixed-wall Rotunda collar bellows",
      color: 0x303336,
      roughness: 0.95,
      metalness: 0.01,
      side: THREE.DoubleSide,
    }),
  };
}`;
  if (!source.includes(oldMaterials)) throw new Error(`${elbowPath}: A1 terminal sleeve material factory anchor is missing`);
  source = source.replace(oldMaterials, newMaterials);

  const oldSideWalls = `  for (const sign of [-1, 1]) {
    addBox(
      THREE,
      parent,
      materials.shell,
      \`UploadedAirportJetwayA1TerminalElbowWall_\${sign}\`,
      [0.10, height, length],
      center.clone().addScaledVector(side, sign * halfWidth),
      yaw,
    );
  }`;
  const recessedPanelSideWalls = `  // Replace the giant uninterrupted wall slab with short physical panels.
  // Each 40 mm joint has a backing plate recessed inside the passenger wall,
  // so the seam reads through shadow/occlusion without becoming a hole, a
  // painted stripe, or external cage-like trim.
  const sidePanelTargetMeters = 0.46;
  const sidePanelGapMeters = 0.040;
  const sidePanelCount = Math.max(3, Math.ceil(length / sidePanelTargetMeters));
  const sidePanelSpanMeters = length / sidePanelCount;
  const sidePanelLengthMeters = Math.max(0.16, sidePanelSpanMeters - sidePanelGapMeters);
  const sideJointBackingInsetMeters = 0.060;
  const sideJointBackingThicknessMeters = 0.025;
  for (const sign of [-1, 1]) {
    for (let panelIndex = 0; panelIndex < sidePanelCount; panelIndex += 1) {
      const panelCenter = start.clone().addScaledVector(direction, sidePanelSpanMeters * (panelIndex + 0.5));
      panelCenter.y = centerY;
      addBox(
        THREE,
        parent,
        materials.shell,
        \`UploadedAirportJetwayA1TerminalElbowWallPanel_\${sign}_\${panelIndex}\`,
        [0.10, height, sidePanelLengthMeters],
        panelCenter.clone().addScaledVector(side, sign * halfWidth),
        yaw,
      );
    }
    for (let jointIndex = 1; jointIndex < sidePanelCount; jointIndex += 1) {
      const jointCenter = start.clone().addScaledVector(direction, sidePanelSpanMeters * jointIndex);
      jointCenter.y = centerY;
      addBox(
        THREE,
        parent,
        materials.rib,
        \`UploadedAirportJetwayA1TerminalElbowRecessedJoint_\${sign}_\${jointIndex}\`,
        [sideJointBackingThicknessMeters, height * 0.94, sidePanelGapMeters * 0.72],
        jointCenter.clone().addScaledVector(side, sign * (halfWidth - sideJointBackingInsetMeters)),
        yaw,
        false,
      );
    }
  }`;
  if (!source.includes(oldSideWalls)) throw new Error(`${elbowPath}: A1 continuous side-wall anchor is missing`);
  source = source.replace(oldSideWalls, recessedPanelSideWalls);

  const oldRibs = `  let ribCount = 0;
  for (let distance = 0.36; distance < length - 0.2; distance += 0.52) {
    const ribCenter = start.clone().addScaledVector(direction, distance);
    ribCenter.y = centerY;
    for (const sign of [-1, 1]) {
      addBox(
        THREE,
        parent,
        materials.rib,
        \`UploadedAirportJetwayA1TerminalElbowRib_\${ribCount}_\${sign}\`,
        [0.035, height * 0.92, 0.04],
        ribCenter.clone().addScaledVector(side, sign * (halfWidth + 0.018)),
        yaw,
        false,
      );
    }
    ribCount += 1;
  }`;
  const roofJoints = `  let ribCount = 0;
  for (let jointIndex = 1; jointIndex < sidePanelCount; jointIndex += 1) {
    const jointCenter = start.clone().addScaledVector(direction, sidePanelSpanMeters * jointIndex);
    jointCenter.y = centerY;
    addBox(
      THREE,
      parent,
      materials.rib,
      \`UploadedAirportJetwayA1TerminalElbowRoofJoint_\${ribCount}\`,
      [width + 0.02, 0.022, sidePanelGapMeters * 0.72],
      jointCenter.clone().add(new THREE.Vector3(0, height * 0.5 + 0.069, 0)),
      yaw,
      false,
    );
    ribCount += 1;
  }`;
  if (!source.includes(oldRibs)) throw new Error(`${elbowPath}: A1 decorative rib loop anchor is missing`);
  source = source.replace(oldRibs, roofJoints);

  const materialCall = "  const materials = createMaterials(THREE);";
  if (!source.includes(materialCall)) throw new Error(`${elbowPath}: A1 terminal sleeve material-call anchor is missing`);
  source = source.replace(materialCall, "  const materials = createMaterials(THREE, tunnelA);");

  if (source.includes("  const width = 2.58;")) {
    source = source.replace("  const width = 2.58;", "  const width = bridgeBellowsWidthMeters;");
  }
  if (source.includes("  const height = 2.44;")) {
    source = source.replace("  const height = 2.44;", "  const height = bridgeBellowsHeightMeters;");
  }

  const telemetryAnchor = `  connector.userData.corrugationRibCount = frame.ribCount;`;
  const telemetry = `${telemetryAnchor}
  connector.userData.suppliedTunnelSkinAuthority = "${marker}";
  connector.userData.suppliedTunnelMaterialName = materials.shellSourceMaterialName;
  connector.userData.suppliedTunnelMatchedWidthMeters = width;
  connector.userData.suppliedTunnelMatchedHeightMeters = height;
  connector.userData.physicalSidePanelCount = frame.sidePanelCount;
  connector.userData.recessedPanelJointCount = frame.ribCount;`;
  if (!source.includes(telemetryAnchor)) throw new Error(`${elbowPath}: A1 terminal sleeve telemetry anchor is missing`);
  source = source.replace(telemetryAnchor, telemetry);

  const returnAnchor = `  return { yaw, ribCount };`;
  if (!source.includes(returnAnchor)) throw new Error(`${elbowPath}: A1 terminal sleeve return anchor is missing`);
  source = source.replace(returnAnchor, `  return { yaw, ribCount, sidePanelCount };`);
}

for (const required of [
  marker,
  "function createMaterials(THREE, tunnelA)",
  'name: "A1 fixed terminal sleeve - opaque source-matched shell"',
  'shellSourceMaterialName: "source-matched-opaque-pbr-no-atlas"',
  "const sidePanelGapMeters = 0.040",
  "const sideJointBackingInsetMeters = 0.060",
  "UploadedAirportJetwayA1TerminalElbowWallPanel_",
  "UploadedAirportJetwayA1TerminalElbowRecessedJoint_",
  "UploadedAirportJetwayA1TerminalElbowRoofJoint_",
  "const materials = createMaterials(THREE, tunnelA)",
  "connector.userData.recessedPanelJointCount = frame.ribCount",
  "return { yaw, ribCount, sidePanelCount }",
]) {
  if (!source.includes(required)) throw new Error(`${elbowPath}: opaque recessed-panel A1 terminal sleeve is missing ${required}`);
}
for (const forbidden of [
  "suppliedTunnelMaterial",
  "UploadedAirportJetwayA1TerminalElbowWall_${sign}",
  "UploadedAirportJetwayA1TerminalElbowSideRail_",
  "UploadedAirportJetwayA1TerminalElbowRib_",
  "halfWidth + 0.018",
  "distance += 0.52",
  "const width = 2.58;",
  "const height = 2.44;",
  'name: "A1 fixed-wall compact terminal-side shell"',
  'shell.name = "A1 fixed terminal sleeve - supplied Tunnel A skin"',
]) {
  if (source.includes(forbidden)) throw new Error(`${elbowPath}: obsolete textured/blank/cage A1 terminal sleeve behavior remains: ${forbidden}`);
}

fs.writeFileSync(elbowPath, source, "utf8");
console.log("Rebuilt the A1 fixed terminal sleeve with measured Tunnel A dimensions, an opaque source-matched PBR shell, short physical side panels and closed recessed dark joints; no Tunnel A atlas is reused on generated geometry and no wall, Rotunda or aircraft position is changed.");
