import fs from "node:fs";

const path = "src/environment/staticJetwayPortalClosures.js";
let source = fs.readFileSync(path, "utf8");

const TARGET_AUTHORITY = "placement-bridgeEnd-shared-with-static-articulation-v1";
const marker = "static-cab-target-shared-with-articulation-v2";

if (!source.includes('const STATIC_CAB_TARGET_AUTHORITY =')) {
  const authorityAnchor = 'const STATIC_CAB_CLOSURE_AUTHORITY = "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3";';
  if (!source.includes(authorityAnchor)) {
    throw new Error(`${path}: static Cab closure authority anchor is missing`);
  }
  source = source.replace(
    authorityAnchor,
    `${authorityAnchor}\nconst STATIC_CAB_TARGET_AUTHORITY = "${TARGET_AUTHORITY}"; // ${marker}`,
  );
}

const summaryAnchor = `    cabClosureAuthority: existing.userData.cabClosureAuthority || "missing",
    authoredNodeTransformCount:`;
const summaryTarget = `    cabClosureAuthority: existing.userData.cabClosureAuthority || "missing",
    cabTargetAuthority: existing.userData.cabTargetAuthority || "missing",
    bridgeEndFallbackCount: Number(existing.userData.bridgeEndFallbackCount ?? Infinity),
    authoredNodeTransformCount:`;
if (source.includes(summaryAnchor)) {
  source = source.replace(summaryAnchor, summaryTarget);
} else if (!source.includes("cabTargetAuthority: existing.userData.cabTargetAuthority")) {
  throw new Error(`${path}: static Cab closure summary anchor is missing`);
}

const fallbackContact = "    const contactDistance = finitePositive(placement.bridgeEnd, 18);";
const exactContact = `    const contactDistance = Number(placement.bridgeEnd);
    if (!(Number.isFinite(contactDistance) && contactDistance > 0)) {
      throw new Error(\`Static Cab closure \${placement.gate} is missing the exact positive placement.bridgeEnd shared with articulation\`);
    }`;
if (source.includes(fallbackContact)) {
  source = source.replace(fallbackContact, exactContact);
} else if (!source.includes("missing the exact positive placement.bridgeEnd shared with articulation")) {
  throw new Error(`${path}: static Cab bridgeEnd fallback anchor is missing`);
}

const userDataAnchor = `  group.userData.cabClosureAuthority = STATIC_CAB_CLOSURE_AUTHORITY;
  group.userData.gateCount = staticPlacements.length;`;
const userDataTarget = `  group.userData.cabClosureAuthority = STATIC_CAB_CLOSURE_AUTHORITY;
  group.userData.cabTargetAuthority = STATIC_CAB_TARGET_AUTHORITY;
  group.userData.bridgeEndFallbackCount = 0;
  group.userData.gateCount = staticPlacements.length;`;
if (source.includes(userDataAnchor)) {
  source = source.replace(userDataAnchor, userDataTarget);
} else if (!source.includes("group.userData.cabTargetAuthority = STATIC_CAB_TARGET_AUTHORITY")) {
  throw new Error(`${path}: static Cab target telemetry anchor is missing`);
}

const exportAnchor = "export { STATIC_CAB_CLOSURE_AUTHORITY as STATIC_JETWAY_CAB_CLOSURE_AUTHORITY };";
const exportTarget = `${exportAnchor}
export { STATIC_CAB_TARGET_AUTHORITY as STATIC_JETWAY_CAB_TARGET_AUTHORITY };`;
if (source.includes(exportAnchor) && !source.includes("STATIC_JETWAY_CAB_TARGET_AUTHORITY")) {
  source = source.replace(exportAnchor, exportTarget);
}

for (const token of [
  marker,
  `STATIC_CAB_TARGET_AUTHORITY = "${TARGET_AUTHORITY}"`,
  "cabTargetAuthority: existing.userData.cabTargetAuthority",
  "bridgeEndFallbackCount: Number(existing.userData.bridgeEndFallbackCount",
  "const contactDistance = Number(placement.bridgeEnd)",
  "missing the exact positive placement.bridgeEnd shared with articulation",
  "group.userData.cabTargetAuthority = STATIC_CAB_TARGET_AUTHORITY",
  "group.userData.bridgeEndFallbackCount = 0",
  "STATIC_JETWAY_CAB_TARGET_AUTHORITY",
]) {
  if (!source.includes(token)) {
    throw new Error(`${path}: exact static Cab target output is missing ${token}`);
  }
}
for (const forbidden of [
  "finitePositive(placement.bridgeEnd, 18)",
  "placement.bridgeEnd ??",
  "11.9 + (gateCode % 4) * 0.65",
  "bridgeEndFallbackCount += 1",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${path}: static Cab target fallback remains: ${forbidden}`);
  }
}

fs.writeFileSync(path, source, "utf8");
console.log("Applied each static Cab closure to the exact positive placement.bridgeEnd shared with articulation and published the shared-target authority with zero fallback use.");
