import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const finalWorldAuthority = "final-visible-a1-tunnel-c-low-contact-world-v1";
const v3 = 'renderer.domElement.dataset.inspectionCameraEndpointBogieProfileAuthority = "a1-final-world-tunnel-c-bogie-apron-half-plane-side-profile-v3";';
const v2 = 'renderer.domElement.dataset.inspectionCameraEndpointBogieProfileAuthority = "a1-tunnel-c-bogie-apron-half-plane-side-profile-v2";';
let source = fs.readFileSync(trainerPath, "utf8");

if (!source.includes(finalWorldAuthority)) {
  throw new Error(`${trainerPath}: final-world Tunnel_C measurement is missing before bogie profile compatibility normalization`);
}
if (source.includes(v3)) source = source.replace(v3, v2);
if (!source.includes(v2)) {
  throw new Error(`${trainerPath}: A1 bogie side-profile authority is missing`);
}
if (!source.includes('inspectionCameraEndpointBogieFinalWorldAuthority')) {
  throw new Error(`${trainerPath}: final-world bogie dataset authority is missing`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Kept the existing A1 bogie side-profile v2 camera orientation while requiring the separate final-world Tunnel_C contact authority for its target coordinates.");

await import(`./prepare-static-supplied-axis-source-heading-v1.mjs?after-bogie-profile=${Date.now()}`);
await import(`./prepare-static-final-own-parking-no-crossing-v1.mjs?after-static-source=${Date.now()}`);
await import(`./prepare-static-a14-corner-arm-articulation-v1.mjs?after-static-own-parking=${Date.now()}`);
await import(`./prepare-static-overlap-diagnostics-v1.mjs?after-static-overlap=${Date.now()}`);
await import(`./prepare-static-connector-inclusive-overlap-guard-v1.mjs?after-static-connector-overlap=${Date.now()}`);
await import(`./prepare-static-a14-connector-inclusive-sweep-v1.mjs?after-static-connector-sweep=${Date.now()}`);
await import(`./prepare-a1-explicit-wall-to-collar-connector-v17.mjs?after-final-a1-static=${Date.now()}`);
