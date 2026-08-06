import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const authority = "exact-authored-a1-lowest-geometry-ramp-contact-v1";
const declarationAnchor = `          const bogieTireCorrection = Number(group.userData.uploadedJetwayBogieTireContactCorrectionMeters ?? NaN);`;
const declarations = `${declarationAnchor}
          const bogieGroundClearance = Number(group.userData.uploadedJetwayBogieGroundClearanceMeters ?? Infinity);
          const bogieGroundContactAuthority = group.userData.uploadedJetwayBogieGroundContactAuthority || "missing";`;
if (source.includes(declarationAnchor) && !source.includes("const bogieGroundClearance =")) {
  source = source.replace(declarationAnchor, declarations);
}

const staleGates = `            || Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6
            || !(bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1)`;
const measuredGates = `            || !Number.isFinite(fleetGroundOffset)
            || !Number.isFinite(bogieTireCorrection)
            || Math.abs(Math.abs(fleetGroundOffset) - bogieTireCorrection) > 1e-6
            || Math.abs(fleetGroundOffset) > 0.5
            || Math.abs(bogieGroundClearance) > 0.005
            || bogieGroundContactAuthority !== "${authority}"`;
if (source.includes(staleGates)) {
  source = source.replace(staleGates, measuredGates);
} else if (!source.includes(`bogieGroundContactAuthority !== "${authority}"`)) {
  throw new Error(`${readinessPath}: stale fixed bogie correction gates are missing`);
}

source = source.replace(
  "installation=${installationAuthority}/${fleetGroundOffset}/${bogieTireCorrection}/${a1TerminalConnectionAuthority}",
  "installation=${installationAuthority}/${fleetGroundOffset}/${bogieTireCorrection}/${bogieGroundClearance}/${bogieGroundContactAuthority}/${a1TerminalConnectionAuthority}",
);

for (const token of [
  "const bogieGroundClearance = Number(group.userData.uploadedJetwayBogieGroundClearanceMeters",
  "const bogieGroundContactAuthority = group.userData.uploadedJetwayBogieGroundContactAuthority",
  "Math.abs(Math.abs(fleetGroundOffset) - bogieTireCorrection) > 1e-6",
  "Math.abs(bogieGroundClearance) > 0.005",
  `bogieGroundContactAuthority !== "${authority}"`,
]) {
  if (!source.includes(token)) {
    throw new Error(`${readinessPath}: measured bogie readiness output is missing ${token}`);
  }
}
if (source.includes("bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1")) {
  throw new Error(`${readinessPath}: obsolete fixed bogie correction range remains`);
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Validated uploaded jetway readiness from exact measured bogie clearance and contact authority instead of a hard-coded 0.06 m offset.");
