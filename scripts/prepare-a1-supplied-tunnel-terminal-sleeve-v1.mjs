import fs from "node:fs";

const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-terminal-sleeve-uses-supplied-tunnel-a-skin-and-cross-section-v1";
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
  // This short fixed leg is part of the jetway visual system, not a new
  // terminal building. Reuse the supplied Tunnel A material instead of
  // painting a separate featureless gray box beside the exact uploaded model.
  let suppliedTunnelMaterial = null;
  tunnelA?.traverse?.((entry) => {
    if (suppliedTunnelMaterial || !entry?.isMesh || entry.visible === false) return;
    const candidates = Array.isArray(entry.material) ? entry.material : [entry.material];
    suppliedTunnelMaterial = candidates.find((material) => material?.isMaterial && material.visible !== false) || null;
  });
  const shell = suppliedTunnelMaterial?.clone?.() || new THREE.MeshStandardMaterial({
    color: 0xe1e2df,
    roughness: 0.78,
    metalness: 0.08,
  });
  shell.name = "A1 fixed terminal sleeve - supplied Tunnel A skin";
  shell.side = THREE.DoubleSide;
  shell.needsUpdate = true;

  return {
    shell,
    shellSourceMaterialName: suppliedTunnelMaterial?.name || "fallback-untextured-shell",
    rib: new THREE.MeshStandardMaterial({
      name: "A1 fixed-wall terminal-side panel seams",
      color: 0xc7cac8,
      roughness: 0.86,
      metalness: 0.05,
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

  const sideRibAnchor = `    for (const sign of [-1, 1]) {
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
    ribCount += 1;`;
  const detailedRib = `    for (const sign of [-1, 1]) {
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
    addBox(
      THREE,
      parent,
      materials.rib,
      \`UploadedAirportJetwayA1TerminalElbowRoofRib_\${ribCount}\`,
      [width + 0.05, 0.035, 0.04],
      ribCenter.clone().add(new THREE.Vector3(0, height * 0.5 + 0.018, 0)),
      yaw,
      false,
    );
    ribCount += 1;`;
  if (!source.includes(sideRibAnchor)) throw new Error(`${elbowPath}: A1 terminal sleeve rib anchor is missing`);
  source = source.replace(sideRibAnchor, detailedRib);

  // Patch these independently. A later preparation pass legitimately changes
  // the shell Y center to Tunnel A passenger height, so matching the entire
  // construction block makes this visual repair unnecessarily order-sensitive.
  for (const [before, after, label] of [
    ["  const materials = createMaterials(THREE);", "  const materials = createMaterials(THREE, tunnelA);", "material source"],
    ["  const width = 2.58;", "  const width = bridgeBellowsWidthMeters;", "measured width"],
    ["  const height = 2.44;", "  const height = bridgeBellowsHeightMeters;", "measured height"],
  ]) {
    if (!source.includes(before)) throw new Error(`${elbowPath}: A1 terminal sleeve ${label} anchor is missing`);
    source = source.replace(before, after);
  }

  const telemetryAnchor = `  connector.userData.corrugationRibCount = frame.ribCount;`;
  const telemetry = `${telemetryAnchor}
  connector.userData.suppliedTunnelSkinAuthority = "${marker}";
  connector.userData.suppliedTunnelMaterialName = materials.shellSourceMaterialName;
  connector.userData.suppliedTunnelMatchedWidthMeters = width;
  connector.userData.suppliedTunnelMatchedHeightMeters = height;`;
  if (!source.includes(telemetryAnchor)) throw new Error(`${elbowPath}: A1 terminal sleeve telemetry anchor is missing`);
  source = source.replace(telemetryAnchor, telemetry);
}

for (const required of [
  marker,
  "function createMaterials(THREE, tunnelA)",
  'shell.name = "A1 fixed terminal sleeve - supplied Tunnel A skin"',
  "const materials = createMaterials(THREE, tunnelA)",
  "const width = bridgeBellowsWidthMeters",
  "const height = bridgeBellowsHeightMeters",
  "UploadedAirportJetwayA1TerminalElbowRoofRib_",
  "connector.userData.suppliedTunnelSkinAuthority",
  "connector.userData.suppliedTunnelMaterialName",
]) {
  if (!source.includes(required)) throw new Error(`${elbowPath}: supplied Tunnel A terminal sleeve is missing ${required}`);
}
for (const forbidden of [
  "const width = 2.58;",
  "const height = 2.44;",
  'name: "A1 fixed-wall compact terminal-side shell"',
]) {
  if (source.includes(forbidden)) throw new Error(`${elbowPath}: fabricated blank A1 terminal sleeve behavior remains: ${forbidden}`);
}

fs.writeFileSync(elbowPath, source, "utf8");
console.log("Matched the A1 terminal-side fixed sleeve to the supplied Tunnel A skin and measured passenger cross-section, with visible roof/side panel ribs and no hard-coded blank gray box dimensions.");
