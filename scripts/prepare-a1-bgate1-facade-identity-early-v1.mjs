import fs from "node:fs";

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const authority = "a1-aug15-bgate1-facade-identity-before-wall-resolution-v1";
let placement = fs.readFileSync(placementPath, "utf8");

if (!placement.includes(authority)) {
  const resolverStart = placement.indexOf("function findTerminalWallConnection(");
  const resolverEnd = placement.indexOf("\nfunction findTerminalWallDistance(", resolverStart);
  if (resolverStart < 0 || resolverEnd < 0) {
    throw new Error(`${placementPath}: terminal wall resolver boundaries are missing`);
  }
  let resolver = placement.slice(resolverStart, resolverEnd);

  const originPredicate = resolver.includes("a1FinalOriginIsA1")
    ? "a1FinalOriginIsA1"
    : resolver.includes("a1OriginIsExactA1")
      ? "a1OriginIsExactA1"
      : null;
  if (!originPredicate) {
    throw new Error(`${placementPath}: A1 origin-owned wall resolver is missing before early BGATE1 lock`);
  }

  // Apply the photographic facade identity BEFORE the explicit A1 wall endpoint
  // is measured. The earlier implementation applied this after the endpoint,
  // remote Rotunda and dogleg were already built, so it could only validate a
  // stale wrong-side wall rather than prevent it.
  if (!resolver.includes("a1EarlyCandidateMaterialName")) {
    const materialAnchor = resolver.match(/(^\s*const\s+material\s*=\s*materials\[[^\n]+\]\s*\?\?\s*materials\[0\];)/m)
      || resolver.match(/(^\s*const\s+materialName\s*=\s*[^;]+;)/m);
    if (materialAnchor) {
      const indent = materialAnchor[1].match(/^\s*/)?.[0] ?? "      ";
      const expression = materialAnchor[1].includes("materialName") ? "materialName" : "material?.name || \"\"";
      resolver = resolver.replace(
        materialAnchor[0],
        `${materialAnchor[0]}\n${indent}const a1EarlyCandidateMaterialName = String(${expression});\n${indent}// ${authority}\n${indent}if (${originPredicate} && !/BGATE1/i.test(a1EarlyCandidateMaterialName)) return false;`,
      );
    } else {
      const returnPattern = /([ \t]*)return \/BGATE\|DGATE\|PHX_TERM400\/i\.test\((?:material\?\.name \|\| ""|materialName)\);/;
      const match = resolver.match(returnPattern);
      if (!match) throw new Error(`${placementPath}: wall ray material predicate is missing before early BGATE1 lock`);
      const indent = match[1];
      resolver = resolver.replace(
        returnPattern,
        `${indent}const a1EarlyCandidateMaterialName = String(typeof materialName !== "undefined" ? materialName : (material?.name || ""));\n${indent}// ${authority}\n${indent}if (${originPredicate} && !/BGATE1/i.test(a1EarlyCandidateMaterialName)) return false;\n${indent}return /BGATE|DGATE|PHX_TERM400/i.test(a1EarlyCandidateMaterialName);`,
      );
    }
  }

  // The nearest-vertex fallback must obey the same identity rule or a missed ray
  // can still snap A1 onto the perpendicular parking/connector structure.
  if (!resolver.includes("a1EarlyCandidateMaterialNames")) {
    const materialsAnchor = /(^\s*const\s+materials\s*=\s*Array\.isArray\(node\.material\)\s*\?\s*node\.material\s*:\s*\[node\.material\];)/m;
    if (materialsAnchor.test(resolver)) {
      resolver = resolver.replace(
        materialsAnchor,
        `$1\n    const a1EarlyCandidateMaterialNames = materials.map((material) => String(material?.name || ""));\n    if (${originPredicate} && !a1EarlyCandidateMaterialNames.some((name) => /BGATE1/i.test(name))) return;`,
      );
    } else {
      const vertexPattern = /([ \t]*)if \(!materials\.some\(\(material\) => \/BGATE\|DGATE\|PHX_TERM400\/i\.test\(material\?\.name \|\| ""\)\)\) return;/;
      const match = resolver.match(vertexPattern);
      if (!match) throw new Error(`${placementPath}: wall vertex material predicate is missing before early BGATE1 lock`);
      const indent = match[1];
      resolver = resolver.replace(
        vertexPattern,
        `${indent}const a1EarlyCandidateMaterialNames = materials.map((material) => String(material?.name || ""));\n${indent}if (${originPredicate} && !a1EarlyCandidateMaterialNames.some((name) => /BGATE1/i.test(name))) return;\n${indent}if (!a1EarlyCandidateMaterialNames.some((name) => /BGATE|DGATE|PHX_TERM400/i.test(name))) return;`,
      );
    }
  }

  // Stamp the resolver itself so repeated production preparation is idempotent.
  const functionBrace = resolver.indexOf("{");
  resolver = `${resolver.slice(0, functionBrace + 1)}\n  // ${authority}: Aug. 15 photo facade identity is resolved before A1 wall/Rotunda geometry.${resolver.slice(functionBrace + 1)}`;
  placement = placement.slice(0, resolverStart) + resolver + placement.slice(resolverEnd);
}

for (const required of [authority, "a1EarlyCandidateMaterialName", "BGATE1", "a1EarlyCandidateMaterialNames"]) {
  if (!placement.includes(required)) throw new Error(`${placementPath}: early A1 BGATE1 wall lock is missing ${required}`);
}

fs.writeFileSync(placementPath, placement, "utf8");
console.log(`Prepared ${authority}: A1 is restricted to the photographed BGATE1 facade before its explicit wall endpoint, remote Rotunda and fixed dogleg are constructed; A3+ remain unchanged.`);
