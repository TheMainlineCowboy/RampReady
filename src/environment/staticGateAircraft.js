import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadSelectedAircraftRuntime } from "../components/aircraft/aircraftRuntimeLoader.js";
import concourseA from "./kphxV181/concourseA.js";

export const STATIC_GATE_AIRCRAFT_PROFILE = Object.freeze({
  source: "active RampReady authored CRJ700 asset",
  gates: Object.freeze(["A2", "A3", "A4", "A5", "A6", "A7", "A8"]),
  coordinateFrame: "A1-local; X=north, Y=up, Z=east",
  sceneOffsetZ: 6.2,
  detailLevel: "authored-crj700-static-gate-population-v1",
});

function gateByName(name) {
  const gate = concourseA.parkings.find((parking) => parking.g === name);
  if (!gate) throw new Error(`Static aircraft gate ${name} is missing from KPHX source parking records`);
  return gate;
}

function configureStaticClone(root, gate) {
  root.name = `PHX_StaticAircraft_${gate.g}`;
  root.position.set(gate.x, 0.02, gate.z + STATIC_GATE_AIRCRAFT_PROFILE.sceneOffsetZ);
  // The authored CRJ points along scene -Z. In the A1-local frame, the decoded
  // 270-degree parking heading is scene -Z, so yaw is the signed difference.
  root.rotation.y = (270 - gate.h) * Math.PI / 180;
  root.userData.staticGate = gate.g;
  root.userData.staticPlacementAuthority = "decoded KPHX ADEX parking position and heading";
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
    node.userData.staticAirportAircraft = true;
  });
}

export async function installStaticGateAircraft(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required for static aircraft");
  const result = await loadSelectedAircraftRuntime({
    THREE,
    loader: new GLTFLoader(),
    baseUri: document.baseURI,
  });
  if (!result.preserveMaterials) {
    throw new Error("Static gate aircraft requires the authored painted CRJ700 asset");
  }

  const group = new THREE.Group();
  group.name = "PHX_AuthoredStaticGateAircraft";
  for (const gateName of STATIC_GATE_AIRCRAFT_PROFILE.gates) {
    const gate = gateByName(gateName);
    const aircraft = result.model.clone(true);
    configureStaticClone(aircraft, gate);
    group.add(aircraft);
  }
  group.userData.assetCandidate = result.candidate.id;
  group.userData.aircraftCount = group.children.length;
  group.userData.gates = [...STATIC_GATE_AIRCRAFT_PROFILE.gates];
  group.userData.detailLevel = STATIC_GATE_AIRCRAFT_PROFILE.detailLevel;
  environment.add(group);
  environment.userData.authoredStaticGateAircraft = group;
  environment.userData.authoredStaticAircraftCount = group.children.length;
  environment.userData.authoredStaticAircraftGates = [...STATIC_GATE_AIRCRAFT_PROFILE.gates];
  environment.userData.authoredStaticAircraftDetailLevel = group.userData.detailLevel;
  return group;
}
