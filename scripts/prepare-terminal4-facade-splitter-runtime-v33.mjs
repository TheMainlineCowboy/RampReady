import fs from "node:fs";

const path = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(path, "utf8");
const authority = "source-package-facade-cell-variation-v31";
const declaration = `const splitterMarker = "${authority}";`;

if (!source.includes(authority) || !source.includes("function splitRepeatedBGATE1Facade")) {
  throw new Error("Terminal 4 source facade splitter was not prepared before runtime binding");
}
if (!source.includes(declaration)) {
  const anchor = "function interpolateFacadeVertex(a, b, t) {";
  if (!source.includes(anchor)) throw new Error("Terminal 4 facade splitter declaration anchor is missing");
  source = source.replace(anchor, `${declaration}\n\n${anchor}`);
}
if (!source.includes("sourceFacadeVariationAuthority: splitterMarker")) {
  throw new Error("Terminal 4 facade splitter is not using its runtime authority binding");
}

fs.writeFileSync(path, source, "utf8");
console.log("Bound the Terminal 4 source facade UV-cell splitter to its committed runtime authority.");
