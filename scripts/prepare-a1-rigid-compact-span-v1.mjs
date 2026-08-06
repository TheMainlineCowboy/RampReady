import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const marker = "post-rigid-a1-exact-visible-vestibule-span-v1";
const broadBlock = `  const terminalDistance = wallOffsetX * rotundaOpening.openingDirectionX
    + wallOffsetZ * rotundaOpening.openingDirectionZ;
  if (!(terminalDistance > rotundaOpening.collarRadius + 0.25 && terminalDistance < 12)) {
    throw new Error(\`A1 cab-pivot terminal span is invalid: \${terminalDistance}\`);
  }

  const rotundaCenterAfter = objectBoundsCenterInFleet(THREE, fleet, rotundaEndpoint);`;
const compactBlock = `  const terminalDistance = wallOffsetX * rotundaOpening.openingDirectionX
    + wallOffsetZ * rotundaOpening.openingDirectionZ;
  const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius;
  // ${marker}
  if (!(terminalDistance > rotundaOpening.collarRadius + 0.25
    && terminalDistance < rotundaOpening.collarRadius + 4.1)
    || Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05) {
    throw new Error(\`A1 post-orientation terminal span is not the same-day-photo 2.4 m vestibule: total=\${terminalDistance}, visible=\${actualVisibleVestibuleMeters}\`);
  }

  const rotundaCenterAfter = objectBoundsCenterInFleet(THREE, fleet, rotundaEndpoint);`;

if (source.includes(broadBlock)) {
  source = source.replace(broadBlock, compactBlock);
} else if (!source.includes(marker)) {
  throw new Error(`${installationPath}: broad post-orientation terminal span block is missing`);
}

const duplicateVisibleDeclaration = `
  const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius;
  const correctedA1Placement = Object.freeze({`;
if (source.includes(duplicateVisibleDeclaration)) {
  source = source.replace(
    duplicateVisibleDeclaration,
    `
  const correctedA1Placement = Object.freeze({`,
  );
}

for (const token of [
  marker,
  "terminalDistance < rotundaOpening.collarRadius + 4.1",
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
  "A1 post-orientation terminal span is not the same-day-photo 2.4 m vestibule",
  "connector.userData.visibleMainLengthMeters = actualVisibleVestibuleMeters",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: post-rigid compact A1 span is missing ${token}`);
  }
}
for (const forbidden of [
  "terminalDistance < 12",
  "terminalDistance < 28",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: broad A1 terminal span survived rigid orientation: ${forbidden}`);
  }
}
const visibleDeclarationCount = (source.match(/const actualVisibleVestibuleMeters =/g) || []).length;
if (visibleDeclarationCount !== 1) {
  throw new Error(`${installationPath}: expected one post-orientation visible-vestibule declaration, received ${visibleDeclarationCount}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Replaced the rigid-parent 12 m terminal allowance with the exact 2.4 m photo-visible A1 vestibule and rejected any later long-corridor span.");
