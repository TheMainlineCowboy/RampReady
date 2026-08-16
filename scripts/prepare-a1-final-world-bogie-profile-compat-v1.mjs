import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const finalWorldAuthority = "final-visible-a1-tunnel-c-low-contact-world-v1";
const finalSupportMarker = "a1-final-world-authored-bogie-support-subset-v1";
const v3 = 'renderer.domElement.dataset.inspectionCameraEndpointBogieProfileAuthority = "a1-final-world-tunnel-c-bogie-apron-half-plane-side-profile-v3";';
const v2 = 'renderer.domElement.dataset.inspectionCameraEndpointBogieProfileAuthority = "a1-tunnel-c-bogie-apron-half-plane-side-profile-v2";';
let source = fs.readFileSync(trainerPath, "utf8");

if (!source.includes(finalWorldAuthority)) {
  throw new Error(`${trainerPath}: final-world Tunnel_C measurement is missing before bogie profile compatibility normalization`);
}

// The final-world evidence stage used to measure every vertex in Tunnel_C even
// though the physical door fitter grounds the authored aircraft-side support
// subsets specifically. Once the bridge is pitched toward the CRJ sill, the
// passenger tunnel shell can extend below the model's historical local-Y datum;
// that is not the bogie/ramp contact point. Point the existing fail-closed world
// measurement at the exact supplied bogie/support source triangles that V11
// physically re-grounds, so visual evidence validates the geometry it names.
if (!source.includes(finalSupportMarker)) {
  const oldResolver = `            const exactA1VisibleTunnelC = exactA1VisibleModel?.getObjectByName?.("Tunnel_C")
              || exactA1VisibleModel?.getObjectByName?.("Tunnel_C_Jetway_0");`;
  const newResolver = `            // ${finalSupportMarker}
            const exactA1VisibleTunnelC = exactA1VisibleModel?.getObjectByName?.("Tunnel_C_DarkBogieLift_SourceTriangles")
              || exactA1VisibleModel?.getObjectByName?.("Tunnel_C_GalvanizedServiceStair_SourceTriangles");`;
  if (!source.includes(oldResolver)) {
    throw new Error(`${trainerPath}: final-world whole-Tunnel_C resolver is missing before support-subset normalization`);
  }
  source = source.replace(oldResolver, newResolver);
  source = source.replace(
    'throw new Error("A1 final-world bogie evidence cannot resolve the visible Tunnel_C hierarchy");',
    'throw new Error("A1 final-world bogie evidence cannot resolve the authored Tunnel_C bogie/support subset");',
  );
}

if (!source.includes(finalSupportMarker)
  || !source.includes('getObjectByName?.("Tunnel_C_DarkBogieLift_SourceTriangles")')
  || source.includes('const exactA1VisibleTunnelC = exactA1VisibleModel?.getObjectByName?.("Tunnel_C")')) {
  throw new Error(`${trainerPath}: final-world bogie evidence is not bound exclusively to the authored support subset`);
}

if (source.includes(v3)) source = source.replace(v3, v2);
if (!source.includes(v2)) {
  throw new Error(`${trainerPath}: A1 bogie side-profile authority is missing`);
}
if (!source.includes('inspectionCameraEndpointBogieFinalWorldAuthority')) {
  throw new Error(`${trainerPath}: final-world bogie dataset authority is missing`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Kept the existing A1 bogie side-profile v2 camera orientation while requiring final-world contact from the exact authored Tunnel-C bogie/support subset grounded by the physical door fitter.");

await import(`./prepare-static-supplied-axis-source-heading-v1.mjs?after-bogie-profile=${Date.now()}`);
await import(`./prepare-static-final-own-parking-no-crossing-v1.mjs?after-static-source=${Date.now()}`);
await import(`./prepare-static-a14-corner-arm-articulation-v1.mjs?after-static-own-parking=${Date.now()}`);
await import(`./prepare-static-overlap-diagnostics-v1.mjs?after-static-overlap=${Date.now()}`);
await import(`./prepare-static-connector-inclusive-overlap-guard-v1.mjs?after-static-connector-overlap=${Date.now()}`);
await import(`./prepare-a1-explicit-wall-to-collar-connector-v17.mjs?after-final-a1-static=${Date.now()}`);
