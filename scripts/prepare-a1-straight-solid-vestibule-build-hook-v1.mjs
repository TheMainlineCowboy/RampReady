import { readFile, writeFile } from "node:fs/promises";

const targetUrl = new URL("./build-production-simulator-quality.mjs", import.meta.url);
let source = await readFile(targetUrl, "utf8");
const call = '  await runNode("scripts/prepare-a1-straight-solid-vestibule-v1.mjs");';

if (!source.includes(call)) {
  const anchor = '  await runNode("scripts/prepare-a1-rotunda-vestibule-closure-v1.mjs");';
  if (!source.includes(anchor)) {
    throw new Error("Could not locate A1 rotunda/vestibule build anchor");
  }
  source = source.replace(anchor, `${anchor}\n${call}`);
}

if (!source.includes(call)) {
  throw new Error("A1 straight-solid vestibule production hook was not installed");
}

await writeFile(targetUrl, source);
console.log("Hooked straight-solid A1 terminal vestibule migration into simulator-quality production build.");
