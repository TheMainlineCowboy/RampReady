import fs from "node:fs";

const groundPath = "src/environment/authoredKphxGround.js";
let source = fs.readFileSync(groundPath, "utf8");
const authority = "source-aerial-blended-world-space-pavement-v7";

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`${groundPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

if (!source.includes(authority)) {
  const helperAnchor = "function applyAuthoredSurfaceMaterials(THREE, authored, textures) {";
  const helper = `function installWorldSpacePavementVariation(material, mode) {
  const authority = "${authority}";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\\nvarying vec3 rrPavementWorldPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\\nrrPavementWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        \`#include <common>
        varying vec3 rrPavementWorldPosition;
        float rrPavementHash(vec2 value) {
          return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
        }\`,
      )
      .replace(
        "#include <color_fragment>",
        \`#include <color_fragment>
        vec2 rrP = rrPavementWorldPosition.xz;
        float rrBroad = sin(rrP.x * 0.0107 + rrP.y * 0.0031) * 0.5
          + cos(rrP.y * 0.0089 - rrP.x * 0.0027) * 0.35
          + sin((rrP.x + rrP.y) * 0.0043) * 0.25;
        float rrFine = rrPavementHash(floor(rrP * 1.75));
        float rrCell = rrPavementHash(floor((rrP + vec2(31.0, 17.0)) / 11.0));
        float rrStain = smoothstep(0.9, 0.995, rrCell) * (0.35 + rrPavementHash(floor(rrP / 2.8)) * 0.65);
        float rrModeScale = ${mode === "asphalt" ? "0.055" : mode === "service-road" ? "0.045" : "0.038"};
        float rrValue = 0.98 + rrBroad * rrModeScale + (rrFine - 0.5) * 0.028;
        diffuseColor.rgb *= rrValue;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.72, rrStain * 0.18);\`,
      );
  };
  material.customProgramCacheKey = () => \`${authority}:\${mode}\`;
  material.userData = {
    ...(material.userData || {}),
    worldSpacePavementAuthority: authority,
    worldSpacePavementMode: mode,
  };
}

${helperAnchor}`;
  if (!source.includes(helperAnchor)) throw new Error(`${groundPath}: missing surface-material function anchor`);
  source = source.replace(helperAnchor, helper);

  replaceRequired(
    `        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.012;
        material.roughness = 0.96;
        material.metalness = 0;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -0.25;
        material.polygonOffsetUnits = -0.5;
        material.userData.nearfieldBlendMode = "opaque-authored-pavement-over-aerial-background";`,
    `        material.map = null;
        material.bumpMap = null;
        material.bumpScale = 0;
        material.color.setHex(0xd4d1ca);
        material.transparent = true;
        material.opacity = 0.72;
        material.depthWrite = true;
        material.roughness = 0.96;
        material.metalness = 0;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -0.25;
        material.polygonOffsetUnits = -0.5;
        installWorldSpacePavementVariation(material, "concrete");
        material.userData.nearfieldBlendMode = "source-aerial-visible-under-seamless-world-detail";`,
    "prepared concrete material block",
  );

  replaceRequired(
    `        material.color.setHex(0x4f5456);
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.roughness = 0.98;
        material.metalness = 0;
        material.userData.nearfieldBlendMode = "opaque-authored-asphalt-over-aerial-background";`,
    `        material.color.setHex(0x555a5c);
        material.transparent = true;
        material.opacity = 0.76;
        material.depthWrite = true;
        material.roughness = 0.98;
        material.metalness = 0;
        installWorldSpacePavementVariation(material, "asphalt");
        material.userData.nearfieldBlendMode = "source-aerial-visible-under-seamless-world-asphalt";`,
    "asphalt material block",
  );

  replaceRequired(
    `        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.014;
        material.roughness = 0.97;
        material.metalness = 0;
        material.userData.nearfieldBlendMode = "opaque-authored-service-road-over-aerial-background";`,
    `        material.map = null;
        material.bumpMap = null;
        material.bumpScale = 0;
        material.color.setHex(0x777976);
        material.transparent = true;
        material.opacity = 0.74;
        material.depthWrite = true;
        material.roughness = 0.97;
        material.metalness = 0;
        installWorldSpacePavementVariation(material, "service-road");
        material.userData.nearfieldBlendMode = "source-aerial-visible-under-seamless-world-service-road";`,
    "service-road material block",
  );
}

for (const token of [
  authority,
  "function installWorldSpacePavementVariation",
  "rrPavementWorldPosition",
  "rrPavementHash",
  'installWorldSpacePavementVariation(material, "concrete")',
  'installWorldSpacePavementVariation(material, "asphalt")',
  'installWorldSpacePavementVariation(material, "service-road")',
  "source-aerial-visible-under-seamless-world-detail",
]) {
  if (!source.includes(token)) throw new Error(`${groundPath}: missing world-space pavement v7 token ${token}`);
}

fs.writeFileSync(groundPath, source, "utf8");
console.log("Prepared seamless PHX pavement v7: world-position wear and stains blend with the supplied source aerial without per-mesh rectangular texture phases.");
