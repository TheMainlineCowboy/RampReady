import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const needle = "A1 decoded KPHX bridge lost the required terminal-side elbow";
const source = fs.readFileSync(sourcePath, "utf8");
const index = source.indexOf(needle);

if (index < 0) {
  console.log("No surviving generated decoded-KPHX terminal-side elbow guard was found after the final A1 preparer chain.");
  process.exit(0);
}

const start = Math.max(0, index - 1600);
const end = Math.min(source.length, index + needle.length + 1600);
const context = source.slice(start, end);
throw new Error(`SURVIVING_A1_DECODED_KPHX_ELBOW_GUARD_CONTEXT_BEGIN\n${context}\nSURVIVING_A1_DECODED_KPHX_ELBOW_GUARD_CONTEXT_END`);
