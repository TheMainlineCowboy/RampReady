import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const staleGuard = `  if (!(sourceTerminalDistance > A1_PHOTO_VISIBLE_VESTIBULE_METERS + 1 && sourceTerminalDistance < 28)) {
    throw new Error(\`A1 measured terminal wall distance is invalid for photo registration: \${sourceTerminalDistance}\`);
  }`;
const measuredCompactGuard = `  // The source wall distance is the package-authored A1 terminal anchor, not the
  // final visible vestibule span. Same-day A1 evidence shows a compact terminal
  // attachment; the 2.4 m visible vestibule is established independently below.
  if (!(sourceTerminalDistance > 0.4 && sourceTerminalDistance < 28)) {
    throw new Error(\`A1 measured compact terminal wall distance is invalid for photo registration: \${sourceTerminalDistance}\`);
  }`;

if (source.includes(staleGuard)) {
  source = source.replace(staleGuard, measuredCompactGuard);
} else if (!source.includes("A1 measured compact terminal wall distance is invalid for photo registration")) {
  throw new Error(`${installationPath}: stale photo-registration source-distance guard is missing`);
}

for (const token of [
  "sourceTerminalDistance > 0.4",
  "A1 measured compact terminal wall distance is invalid for photo registration",
  "sourceRotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: compact source-wall correction is missing ${token}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Accepted the measured compact A1 source wall anchor independently from the photo-visible vestibule span.");
