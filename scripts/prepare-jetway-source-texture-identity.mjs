import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");
const marker = "group.userData.jetwayTextureSourceIdentity";
if (!source.includes(marker)) {
  const anchor = `  group.userData.jetwayTextureMappingAuthority = sourceTextures.diffuse
    ? "normalized-fallback-geometry-uvs-with-exact-atlas-subregions-never-whole-atlas-repeat"
    : "missing";`;
  if (!source.includes(anchor)) throw new Error("Jetway source-texture identity anchor is missing");
  source = source.replace(
    anchor,
    `${anchor}
  group.userData.jetwayTextureSourceIdentity = sourceTextures.diffuse
    ? "M1DGJETWAY exact recovered original freeware texture and lightmap"
    : "missing";`,
  );
  fs.writeFileSync(path, source, "utf8");
}
for (const token of [
  "group.userData.jetwayTextureSourceIdentity",
  "M1DGJETWAY exact recovered original freeware texture and lightmap",
  "normalized-fallback-geometry-uvs-with-exact-atlas-subregions-never-whole-atlas-repeat",
]) {
  const prepared = fs.readFileSync(path, "utf8");
  if (!prepared.includes(token)) throw new Error(`Jetway source identity is missing ${token}`);
}
console.log("Prepared separate AIR_Jetway01 source texture identity and atlas-region mapping authority.");
