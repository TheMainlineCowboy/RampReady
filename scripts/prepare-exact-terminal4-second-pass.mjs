import fs from "node:fs";

const path = "scripts/prepare-exact-terminal4-textures.mjs";
let source = fs.readFileSync(path, "utf8");
const oldText = `if (!verifier.includes('"manifest.emissiveTextureCount !== 15"')) throw new Error("Terminal 4 exact verifier lightmap count was not upgraded to 15");`;
const newText = `if (![\n  '"manifest.emissiveTextureCount !== 15"',\n  '"exactLightmapCount !== 15"',\n].some((token) => verifier.includes(token))) throw new Error("Terminal 4 exact verifier lightmap count was not upgraded to 15");`;
if (source.includes(oldText)) source = source.replace(oldText, newText);
if (!source.includes('"exactLightmapCount !== 15"')) throw new Error("Terminal 4 exact preparation still rejects the normalized second-pass lightmap contract");
fs.writeFileSync(path, source, "utf8");
console.log("Prepared exact Terminal 4 second pass: both manifest and normalized 15-lightmap contract forms are accepted.");
