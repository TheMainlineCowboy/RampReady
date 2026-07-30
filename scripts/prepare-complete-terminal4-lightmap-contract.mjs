import fs from "node:fs";

const path = "scripts/verify-kphx-v181-source-contract.mjs";
let source = fs.readFileSync(path, "utf8");
const replacements = [
  ['"manifest.emissiveTextureCount !== 11"', '"manifest.emissiveTextureCount !== 15"'],
  ["pinned-exact-source-lightmaps-active-no-invented-missing-maps", "all-15-exact-source-lightmaps-active-no-missing-dependencies"],
  ["missing package dependencies remain unfilled", "all recovered dependencies are active"],
];
for (const [oldText, newText] of replacements) {
  if (source.includes(newText)) continue;
  if (!source.includes(oldText)) throw new Error(`Complete Terminal 4 lightmap contract anchor is missing: ${oldText}`);
  source = source.replace(oldText, newText);
}
for (const token of [
  '"manifest.emissiveTextureCount !== 15"',
  "all-15-exact-source-lightmaps-active-no-missing-dependencies",
  "all recovered dependencies are active",
]) {
  if (!source.includes(token)) throw new Error(`Complete Terminal 4 lightmap contract is missing ${token}`);
}
fs.writeFileSync(path, source, "utf8");
console.log("Prepared complete Terminal 4 lightmap contract: 15 exact maps and no missing dependencies.");
