import fs from "node:fs";

const path = "scripts/verify-kphx-v181-source-contract.mjs";
let source = fs.readFileSync(path, "utf8");

const lightmapForms = [
  '"manifest.emissiveTextureCount !== 15"',
  '"exactLightmapCount !== 15"',
];
if (!lightmapForms.some((token) => source.includes(token))) {
  const historical = '"manifest.emissiveTextureCount !== 11"';
  if (!source.includes(historical)) throw new Error(`Complete Terminal 4 lightmap contract anchor is missing: ${historical}`);
  source = source.replace(historical, lightmapForms[0]);
}

for (const [oldText, newText] of [
  ["pinned-exact-source-lightmaps-active-no-invented-missing-maps", "all-15-exact-source-lightmaps-active-no-missing-dependencies"],
  ["missing package dependencies remain unfilled", "all recovered dependencies are active"],
]) {
  if (source.includes(newText)) continue;
  if (!source.includes(oldText)) throw new Error(`Complete Terminal 4 lightmap contract anchor is missing: ${oldText}`);
  source = source.replace(oldText, newText);
}

if (!lightmapForms.some((token) => source.includes(token))) throw new Error("Complete Terminal 4 lightmap count contract is missing");
for (const token of [
  "all-15-exact-source-lightmaps-active-no-missing-dependencies",
  "all recovered dependencies are active",
]) {
  if (!source.includes(token)) throw new Error(`Complete Terminal 4 lightmap contract is missing ${token}`);
}
fs.writeFileSync(path, source, "utf8");
console.log("Prepared complete Terminal 4 lightmap contract: 15 exact maps and no missing dependencies in either valid prepared form.");
