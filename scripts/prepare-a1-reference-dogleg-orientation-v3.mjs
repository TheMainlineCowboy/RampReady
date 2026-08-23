import fs from "node:fs";

const path = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const priorAuthority = "a1-aug15-reference-matched-dogleg-v2";
const authority = "a1-aug15-reference-photo-dogleg-orientation-v3";
const facadeAuthority = "a1-aug15-reference-bgate1-facade-identity-v1";
let source = fs.readFileSync(path, "utf8");
let placement = fs.readFileSync(placementPath, "utf8");

if (!source.includes(priorAuthority)) {
  throw new Error(`${path}: ${priorAuthority} must exist before final photo-orientation correction`);
}

if (!source.includes(authority)) {
  // Re-read the Aug. 15 overhead literally: from the remote Rotunda, the fixed
  // elbow lies on the terminal/opposite side of the movable bridge. Therefore
  // elbow -> Rotunda and Rotunda -> aircraft continue through the Rotunda in the
  // same general direction. The prior v2 "same hemisphere" interpretation put
  // the elbow on the aircraft side and produced the giant diagonal/folded route
  // visible in exact-head overhead evidence.
  const sameSide = "  const rotundaTerminalBranchDirection = bridgeDirection.clone().normalize();";
  const photoSide = `  // ${authority}\n  const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();`;
  if (!source.includes(sameSide)) {
    throw new Error(`${path}: v2 same-side dogleg branch is missing`);
  }
  source = source.replace(sameSide, photoSide);

  const telemetry = `  group.userData.uploadedJetwayA1ReferenceMatchedDoglegAuthority = "${priorAuthority}";`;
  if (!source.includes(telemetry)) {
    throw new Error(`${path}: v2 dogleg telemetry anchor is missing`);
  }
  source = source.replace(
    telemetry,
    `${telemetry}\n  group.userData.uploadedJetwayA1ReferencePhotoOrientationAuthority = "${authority}";`,
  );
}

// The reference photos also make the terminal ownership unambiguous: A1 leaves
// the tan BGATE1 Terminal 4 facade. A generic BGATE/DGATE/PHX_TERM400 hit is not
// sufficient at this corner because the parking-side/perpendicular structures
// are closer and previously won the fallback search. Keep A3+ unchanged, but
// when the resolver is operating from the exact A1 source origin, reject every
// ray/vertex candidate that is not BGATE1 source-facade geometry.
if (!placement.includes(facadeAuthority)) {
  if (!placement.includes("const a1OriginIsExactA1 = Math.hypot(")) {
    throw new Error(`${placementPath}: A1 origin-owned facade resolver is missing before BGATE1 identity lock`);
  }

  const castMaterialBlock = `      const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];\n      return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");`;
  const castReplacement = `      const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];\n      const materialName = String(material?.name || "");\n      // ${facadeAuthority}: the real A1 corridor belongs to BGATE1, never the nearby parking/side structure.\n      if (a1OriginIsExactA1 && !/BGATE1/i.test(materialName)) return false;\n      return /BGATE|DGATE|PHX_TERM400/i.test(materialName);`;
  if (!placement.includes(castMaterialBlock)) {
    throw new Error(`${placementPath}: authored-wall ray material filter is missing before BGATE1 identity lock`);
  }
  placement = placement.replace(castMaterialBlock, castReplacement);

  const vertexMaterialBlock = `    const materials = Array.isArray(node.material) ? node.material : [node.material];\n    if (!materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test(material?.name || ""))) return;`;
  const vertexReplacement = `    const materials = Array.isArray(node.material) ? node.material : [node.material];\n    const materialNames = materials.map((material) => String(material?.name || ""));\n    if (a1OriginIsExactA1 && !materialNames.some((name) => /BGATE1/i.test(name))) return;\n    if (!materialNames.some((name) => /BGATE|DGATE|PHX_TERM400/i.test(name))) return;`;
  if (!placement.includes(vertexMaterialBlock)) {
    throw new Error(`${placementPath}: authored-wall vertex material filter is missing before BGATE1 identity lock`);
  }
  placement = placement.replace(vertexMaterialBlock, vertexReplacement);
}

for (const required of [
  authority,
  "const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();",
  "const doglegSecondLegDirection = rotundaSurfacePoint.clone().sub(doglegElbowPoint).setY(0).normalize();",
  "uploadedJetwayA1ReferencePhotoOrientationAuthority",
]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: final A1 photo-orientation output is missing ${required}`);
  }
}
if (source.includes("const rotundaTerminalBranchDirection = bridgeDirection.clone().normalize();")) {
  throw new Error(`${path}: stale same-side A1 elbow survived final photo-orientation correction`);
}

for (const required of [
  facadeAuthority,
  "if (a1OriginIsExactA1 && !/BGATE1/i.test(materialName)) return false;",
  "if (a1OriginIsExactA1 && !materialNames.some((name) => /BGATE1/i.test(name))) return;",
]) {
  if (!placement.includes(required)) {
    throw new Error(`${placementPath}: final A1 BGATE1 facade identity output is missing ${required}`);
  }
}

fs.writeFileSync(path, source, "utf8");
fs.writeFileSync(placementPath, placement, "utf8");
console.log(`Prepared ${authority} + ${facadeAuthority}: A1's fixed elbow remains terminal/opposite of the remote Rotunda and every A1 terminal-wall candidate is now required to come from the actual BGATE1 source facade; A3+ remain unchanged.`);
