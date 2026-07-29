import * as THREE from "three";
import { installExactKphxA1SourceLights } from "../src/environment/kphxExactA1/sourceLights.js";

function buildStrip(name, toneMapped, color, startZ, endZ) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.1, 0.09, startZ,
    -0.1, 0.09, endZ,
    0.1, 0.09, endZ,
    0.1, 0.09, startZ,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const material = new THREE.MeshBasicMaterial({ color, toneMapped });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

const exactA1 = new THREE.Group();
exactA1.name = "KPHX_A1_ExactSuppliedSource";
exactA1.add(
  buildStrip("KPHX_A1_ExactPaintedLineType_300", false, 0xf3c400, 0, 11),
  buildStrip("KPHX_A1_ExactPaintedLineType_301", true, 0xffffff, 20, 31),
);

const lighting = installExactKphxA1SourceLights(THREE, exactA1);
if (lighting.parent !== exactA1) throw new Error("KPHX source lighting was not attached to the exact A1 root");
if (lighting.userData.fixtureCount !== 3) {
  throw new Error(`Expected 3 sampled exact-source fixtures, received ${lighting.userData.fixtureCount}`);
}
if (lighting.userData.physicalLightCount !== 3) throw new Error("KPHX physical light count drifted");
if (lighting.userData.colorGroupCount !== 1) throw new Error("Non-lighted painted lines leaked into source lighting");
if (!lighting.getObjectByName("KPHX_A1_SourceLightFixtures_f3c400")) throw new Error("Instanced source fixtures are missing");
if (!lighting.getObjectByName("KPHX_A1_SourceLightHalos_f3c400")) throw new Error("Instanced source halos are missing");
if (lighting.children.filter((child) => child.isPointLight).length !== 3) throw new Error("Nearby source photometric lights are missing");

console.log("Verified exact KPHX A1 source lighting: decoded lighted strips produce instanced fixtures, halos and nearby physical lights.");
