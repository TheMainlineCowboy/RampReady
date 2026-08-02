import fs from "node:fs";

const groundPath = "src/environment/authoredKphxGround.js";
let source = fs.readFileSync(groundPath, "utf8");
const authority = "full-source-aerial-primary-with-subtle-package-surface-detail-v41";

function replaceRequired(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${groundPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

replaceRequired(
  `        material.transparent = false;
        material.opacity = 1;
        material.alphaTest = 0;
        material.depthWrite = true;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.012;
        material.roughness = 0.96;
        material.metalness = 0;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -0.25;
        material.polygonOffsetUnits = -0.5;
        material.userData.nearfieldBlendMode = "opaque-authored-pavement-over-aerial-background";
        node.renderOrder = Math.max(node.renderOrder || 0, 30);`,
  `        // ${authority}
        // The full-resolution package aerial is the visible airport pavement.
        // This source-derived PARKRAMPS field supplies only fine concrete grain
        // and bump detail, never an opaque replacement sheet over the airport.
        material.transparent = true;
        material.opacity = 0.18;
        material.alphaTest = 0;
        material.depthWrite = false;
        material.depthTest = true;
        material.blending = THREE.NormalBlending;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.008;
        material.roughness = 0.96;
        material.metalness = 0;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -0.25;
        material.polygonOffsetUnits = -0.5;
        material.userData.nearfieldBlendMode = "${authority}";
        material.userData.sourceAerialPriority = true;
        node.renderOrder = Math.max(node.renderOrder || 0, 2);`,
  "concrete source-aerial blend",
);

replaceRequired(
  `        material.color.setHex(0x4f5456);
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.roughness = 0.98;
        material.metalness = 0;
        material.userData.nearfieldBlendMode = "opaque-authored-asphalt-over-aerial-background";
        node.renderOrder = Math.max(node.renderOrder || 0, 20);`,
  `        material.color.setHex(0x54595b);
        material.transparent = true;
        material.opacity = 0.2;
        material.depthWrite = false;
        material.depthTest = true;
        material.blending = THREE.NormalBlending;
        material.roughness = 0.98;
        material.metalness = 0;
        material.userData.nearfieldBlendMode = "${authority}";
        material.userData.sourceAerialPriority = true;
        node.renderOrder = Math.max(node.renderOrder || 0, 1);`,
  "asphalt source-aerial blend",
);

replaceRequired(
  `        material.color.setHex(0x777976);
        material.transparent = false;
        material.opacity = 1;
        material.alphaTest = 0;
        material.depthWrite = true;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.014;
        material.roughness = 0.97;
        material.metalness = 0;
        material.userData.nearfieldBlendMode = "opaque-authored-service-road-over-aerial-background";
        node.renderOrder = Math.max(node.renderOrder || 0, 35);`,
  `        material.color.setHex(0x777976);
        material.transparent = true;
        material.opacity = 0.14;
        material.alphaTest = 0;
        material.depthWrite = false;
        material.depthTest = true;
        material.blending = THREE.NormalBlending;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.006;
        material.roughness = 0.97;
        material.metalness = 0;
        material.userData.nearfieldBlendMode = "${authority}";
        material.userData.sourceAerialPriority = true;
        node.renderOrder = Math.max(node.renderOrder || 0, 3);`,
  "service-road source-aerial blend",
);

replaceRequired(
  `  environment.userData.authoredGroundTexturedSurfaceMaterialCount = materialState.sourceDetailedSurfaceMaterialCount;`,
  `  environment.userData.authoredGroundTexturedSurfaceMaterialCount = materialState.sourceDetailedSurfaceMaterialCount;
  environment.userData.authoredGroundPavementAuthority = "${authority}";
  environment.userData.authoredGroundSourceAerialPriority = true;
  environment.userData.authoredGroundNearfieldDetailOpacity = 0.18;`,
  "ground runtime authority",
);

for (const token of [
  authority,
  "material.opacity = 0.18",
  "material.opacity = 0.2",
  "material.opacity = 0.14",
  "material.depthWrite = false",
  "material.userData.sourceAerialPriority = true",
  "environment.userData.authoredGroundSourceAerialPriority = true",
]) {
  if (!source.includes(token)) throw new Error(`${groundPath}: missing source-aerial pavement token ${token}`);
}
for (const forbidden of [
  'material.userData.nearfieldBlendMode = "opaque-authored-pavement-over-aerial-background"',
  'material.userData.nearfieldBlendMode = "opaque-authored-asphalt-over-aerial-background"',
  'material.userData.nearfieldBlendMode = "opaque-authored-service-road-over-aerial-background"',
]) {
  if (source.includes(forbidden)) throw new Error(`${groundPath}: stale opaque pavement authority remains: ${forbidden}`);
}

fs.writeFileSync(groundPath, source, "utf8");
console.log("Prepared KPHX source-aerial pavement priority v41: the complete package aerial remains visible while ADEX concrete, asphalt and service-road geometry provide only subtle surface detail.");
