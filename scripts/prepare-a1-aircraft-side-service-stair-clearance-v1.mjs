import fs from "node:fs";

const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-service-stair-cab-side-swing-clearance-v1";
const authority = "exact-supplied-tunnel-c-service-stair-rigid-swing-clearance-v1";
const finalVisibleMarker = "a1-final-visible-grounded-door-and-integrated-tunnel-c-v1";
const runtimeSupportMarker = "a1-runtime-tunnel-c-separable-support-meshes-v1";
const importLine = 'import { articulateA1ServiceStairClearOfAircraft } from "./a1ServiceStairClearanceV1.js";';

let source = fs.readFileSync(doorFitPath, "utf8");

if (!source.includes(finalVisibleMarker)) {
  throw new Error(`${doorFitPath}: service-stair clearance must run after final visible door normalization`);
}
if (!source.includes(runtimeSupportMarker)) {
  throw new Error(`${doorFitPath}: service-stair clearance requires final Tunnel-C support normalization`);
}

if (!source.includes(marker)) {
  const importAnchor = 'const AUTHORITY = "supplied-a1-full-3d-crj-door-fit-v11";';
  if (!source.includes(importAnchor)) {
    throw new Error(`${doorFitPath}: final A1 fitter import anchor is missing`);
  }
  source = source.replace(importAnchor, `${importLine}\n// ${marker}\n${importAnchor}`);

  const solveAnchor = `  anchor.rotation.y = correctedYawRadians;\n  anchor.updateMatrixWorld(true);\n  model.updateMatrixWorld(true);\n  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);`;
  if (!source.includes(solveAnchor)) {
    throw new Error(`${doorFitPath}: final parent-yaw service-stair insertion anchor is missing`);
  }
  source = source.replace(
    solveAnchor,
    `${solveAnchor}\n\n  const serviceStairClearance = articulateA1ServiceStairClearOfAircraft(\n    THREE, group, model, targetWorld, cabRelativeYawRadians,\n  );`,
  );

  const resultAnchor = `    contactWidthMeters: cabAssembly.contactWidth,\n    stairGrounding,`;
  if (!source.includes(resultAnchor)) {
    throw new Error(`${doorFitPath}: service-stair result telemetry anchor is missing`);
  }
  source = source.replace(
    resultAnchor,
    `    contactWidthMeters: cabAssembly.contactWidth,\n    serviceStairClearance,\n    stairGrounding,`,
  );

  const telemetryAnchor = `  group.userData.uploadedJetwayA1DoorFitContactWidthMeters = cabAssembly.contactWidth;\n  return result;`;
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${doorFitPath}: service-stair dataset telemetry anchor is missing`);
  }
  source = source.replace(
    telemetryAnchor,
    `  group.userData.uploadedJetwayA1DoorFitContactWidthMeters = cabAssembly.contactWidth;\n  group.userData.uploadedJetwayA1ServiceStairClearanceAuthority = serviceStairClearance.authority;\n  group.userData.uploadedJetwayA1ServiceStairTriangleCount = serviceStairClearance.stairTriangleCount;\n  group.userData.uploadedJetwayA1ServiceStairSwingDegrees = serviceStairClearance.swingDegrees;\n  group.userData.uploadedJetwayA1ServiceStairFuselagePenetrationMeters = serviceStairClearance.afterFuselagePlanePenetrationMeters;\n  return result;`,
  );
}

for (const required of [
  marker,
  importLine,
  "articulateA1ServiceStairClearOfAircraft",
  "serviceStairClearance",
  "uploadedJetwayA1ServiceStairSwingDegrees",
  "uploadedJetwayA1ServiceStairFuselagePenetrationMeters",
]) {
  if (!source.includes(required)) {
    throw new Error(`${doorFitPath}: final A1 service-stair clearance is missing ${required}`);
  }
}

if (!fs.readFileSync("src/environment/a1ServiceStairClearanceV1.js", "utf8").includes(authority)) {
  throw new Error("A1 service-stair runtime module is missing its exact supplied-geometry authority");
}

fs.writeFileSync(doorFitPath, source, "utf8");
console.log(`Prepared ${marker}: the final A1 fitter invokes the exact-source service-stair rigid clearance solver after all Tunnel-C/Cab placement and before production Vite bundling.`);
