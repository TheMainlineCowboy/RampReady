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

// The reference photos make terminal ownership unambiguous: A1 leaves the tan
// BGATE1 Terminal 4 facade. Patch the resolver semantically instead of requiring
// one exact generated return expression: later preparers may rewrite the wall
// material predicate while preserving the same material extraction. A3+ remain
// unchanged because the filter is keyed to the exact A1 source origin.
if (!placement.includes(facadeAuthority)) {
  const resolverStart = placement.indexOf("function findTerminalWallConnection(");
  const resolverEnd = placement.indexOf("\nfunction findTerminalWallDistance(", resolverStart);
  if (resolverStart < 0 || resolverEnd < 0) {
    throw new Error(`${placementPath}: terminal wall resolver boundaries are missing`);
  }
  let resolver = placement.slice(resolverStart, resolverEnd);

  // Do not depend on a predicate installed by an earlier/later preparer. This
  // stage can run against the clean tracked placement source, so establish A1
  // ownership inside the resolver itself from the exact decoded A1 source
  // origin. Accept both the raw BGL-local Z and the scene-offset Z form.
  let a1Predicate = "a1ReferenceFacadeOriginIsA1";
  if (!resolver.includes(`const ${a1Predicate} =`)) {
    const preferredAnchor = "  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();";
    if (!resolver.includes(preferredAnchor)) {
      throw new Error(`${placementPath}: preferred wall direction anchor is missing before BGATE1 identity lock`);
    }
    const rawA1X = -21.01;
    const rawA1Z = -16.15;
    const sceneA1Z = rawA1Z + 6.2;
    resolver = resolver.replace(
      preferredAnchor,
      `${preferredAnchor}\n  const ${a1Predicate} = Math.min(\n    Math.hypot(originX - (${rawA1X}), originZ - (${rawA1Z})),\n    Math.hypot(originX - (${rawA1X}), originZ - (${sceneA1Z})),\n  ) <= 0.35;`,
    );
  }

  if (!resolver.includes("a1CandidateMaterialName")) {
    const materialAnchorPatterns = [
      /(^\s*const\s+material\s*=\s*materials\[[^\n]+\]\s*\?\?\s*materials\[0\];)/m,
      /(^\s*const\s+materialName\s*=\s*[^;]+;)/m,
    ];
    let inserted = false;
    for (const pattern of materialAnchorPatterns) {
      const match = resolver.match(pattern);
      if (!match) continue;
      const indent = match[1].match(/^\s*/)?.[0] ?? "      ";
      const materialExpression = match[1].includes("materialName")
        ? "materialName"
        : "material?.name || \"\"";
      resolver = resolver.replace(
        pattern,
        `$1\n${indent}const a1CandidateMaterialName = String(${materialExpression});\n${indent}// ${facadeAuthority}: A1 must hit the actual BGATE1 source facade, never the nearby parking/side structure.\n${indent}if (${a1Predicate} && !/BGATE1/i.test(a1CandidateMaterialName)) return false;`,
      );
      inserted = true;
      break;
    }
    if (!inserted) {
      const rayReturnPattern = /([ \t]*)return \/BGATE\|DGATE\|PHX_TERM400\/i\.test\((?:material\?\.name \|\| ""|materialName)\);/;
      const rayMatch = resolver.match(rayReturnPattern);
      if (!rayMatch) {
        throw new Error(`${placementPath}: authored-wall ray material extraction is missing before BGATE1 identity lock`);
      }
      const indent = rayMatch[1];
      resolver = resolver.replace(
        rayReturnPattern,
        `${indent}const a1CandidateMaterialName = String(typeof materialName !== "undefined" ? materialName : (material?.name || ""));\n${indent}// ${facadeAuthority}: A1 must hit the actual BGATE1 source facade, never the nearby parking/side structure.\n${indent}if (${a1Predicate} && !/BGATE1/i.test(a1CandidateMaterialName)) return false;\n${indent}return /BGATE|DGATE|PHX_TERM400/i.test(a1CandidateMaterialName);`,
      );
    }
  }

  if (!resolver.includes("a1CandidateMaterialNames")) {
    const materialsAnchor = /(^\s*const\s+materials\s*=\s*Array\.isArray\(node\.material\)\s*\?\s*node\.material\s*:\s*\[node\.material\];)/m;
    if (materialsAnchor.test(resolver)) {
      resolver = resolver.replace(
        materialsAnchor,
        `$1\n    const a1CandidateMaterialNames = materials.map((material) => String(material?.name || ""));\n    if (${a1Predicate} && !a1CandidateMaterialNames.some((name) => /BGATE1/i.test(name))) return;`,
      );
    } else {
      const vertexPattern = /([ \t]*)if \(!materials\.some\(\(material\) => \/BGATE\|DGATE\|PHX_TERM400\/i\.test\(material\?\.name \|\| ""\)\)\) return;/;
      const vertexMatch = resolver.match(vertexPattern);
      if (!vertexMatch) {
        throw new Error(`${placementPath}: authored-wall vertex material extraction is missing before BGATE1 identity lock`);
      }
      const indent = vertexMatch[1];
      resolver = resolver.replace(
        vertexPattern,
        `${indent}const a1CandidateMaterialNames = materials.map((material) => String(material?.name || ""));\n${indent}if (${a1Predicate} && !a1CandidateMaterialNames.some((name) => /BGATE1/i.test(name))) return;\n${indent}if (!a1CandidateMaterialNames.some((name) => /BGATE|DGATE|PHX_TERM400/i.test(name))) return;`,
      );
    }
  }

  placement = placement.slice(0, resolverStart) + resolver + placement.slice(resolverEnd);
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
  "a1ReferenceFacadeOriginIsA1",
  "a1CandidateMaterialName",
  "BGATE1",
  "a1CandidateMaterialNames",
]) {
  if (!placement.includes(required)) {
    throw new Error(`${placementPath}: final A1 BGATE1 facade identity output is missing ${required}`);
  }
}

fs.writeFileSync(path, source, "utf8");
fs.writeFileSync(placementPath, placement, "utf8");
console.log(`Prepared ${authority} + ${facadeAuthority}: A1's fixed elbow remains terminal/opposite of the remote Rotunda and every A1 terminal-wall candidate is required to come from the actual BGATE1 source facade; A3+ remain unchanged.`);
