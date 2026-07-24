import { readFile } from "node:fs/promises";
import { loadSelectedAircraftRuntime } from "../src/components/aircraft/aircraftRuntimeLoader.js";

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
}

class Box3 {
  setFromObject(object) { this.object = object; return this; }
  getSize(target) {
    target.x = this.object.userData.testSize.x;
    target.y = this.object.userData.testSize.y;
    target.z = this.object.userData.testSize.z;
    return target;
  }
}

function makeModel(material = { name: "authored" }) {
  const mesh = {
    isMesh: true,
    material,
    geometry: { getAttribute: () => true },
    userData: {},
  };
  return {
    name: "",
    userData: { testSize: { x: 23.64, y: 7.5, z: 32.5 } },
    updateMatrixWorld() {},
    traverse(callback) { callback(mesh); },
    mesh,
  };
}

const THREE = { Box3, Vector3 };
const userMetadata = {
  contractVersion: 1,
  aircraftType: "CRJ700",
  sha256: "a".repeat(64),
  orientation: { up: "+Y", forward: "-Z" },
  dimensionsMeters: { length: 32.5, wingspan: 23.64 },
  noseGearCaptureOrigin: [0, 0.41, -4.82],
  preserveMaterials: true,
};

const userModel = makeModel();
let fallbackMaterialCalls = 0;
const userResult = await loadSelectedAircraftRuntime({
  THREE,
  loader: { loadAsync: async () => ({ scene: userModel }) },
  baseUri: "https://example.test/RampReady/",
  fetchImpl: async (url) => ({
    ok: url.endsWith("crj700-user.asset.json"),
    status: 404,
    json: async () => userMetadata,
  }),
  applyFallbackMaterial: () => { fallbackMaterialCalls += 1; },
});

if (userResult.candidate.id !== "user-painted-crj700") throw new Error("user aircraft was not preferred");
if (!userResult.preserveMaterials) throw new Error("user materials were not preserved");
if (fallbackMaterialCalls !== 0) throw new Error("fallback material was applied to user aircraft");
if (userModel.mesh.material.name !== "authored") throw new Error("authored material changed");
if (userResult.captureOrigin.join(",") !== "0,0.41,-4.82") throw new Error("capture origin was not propagated");
if (!userModel.mesh.castShadow || !userModel.mesh.receiveShadow) throw new Error("runtime mesh configuration missing");

const fallbackModel = makeModel();
const fallbackResult = await loadSelectedAircraftRuntime({
  THREE,
  loader: { loadAsync: async () => ({ scene: fallbackModel }) },
  baseUri: "https://example.test/RampReady/",
  fetchImpl: async () => ({ ok: false, status: 404 }),
  applyFallbackMaterial: (model) => { fallbackMaterialCalls += 1; model.mesh.material = { name: "procedural" }; },
});

if (fallbackResult.candidate.id !== "prepared-crj700-fallback") throw new Error("fallback aircraft was not selected");
if (fallbackResult.preserveMaterials) throw new Error("fallback material policy is incorrect");
if (fallbackMaterialCalls !== 1 || fallbackModel.mesh.material.name !== "procedural") throw new Error("fallback material was not applied exactly once");

const invalidModel = makeModel();
invalidModel.userData.testSize.z = 40;
let rejected = false;
try {
  await loadSelectedAircraftRuntime({
    THREE,
    loader: { loadAsync: async () => ({ scene: invalidModel }) },
    baseUri: "https://example.test/RampReady/",
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });
} catch (error) {
  rejected = String(error).includes("Unexpected CRJ700 dimensions");
}
if (!rejected) throw new Error("invalid runtime dimensions were accepted");

const activeModelSource = await readFile(new URL("../src/components/aircraft/crj700Model.js", import.meta.url), "utf8");
for (const required of [
  'import { loadSelectedAircraftRuntime } from "./aircraftRuntimeLoader.js"',
  "loadSelectedAircraftRuntime({",
  "result.preserveMaterials",
  'role === "operational-light"',
  'role === "training-capture-marker"',
  'source: sourceId',
]) {
  if (!activeModelSource.includes(required)) throw new Error(`active CRJ runtime integration missing: ${required}`);
}
if (activeModelSource.includes('new URL("models/crj700-mobile.glb"')) throw new Error("active CRJ runtime still hardcodes the fallback GLB");
if (activeModelSource.includes("applyVisibleBaseLivery(THREE, realModel);")) throw new Error("active CRJ runtime still repaints every selected model");

console.log("RampReady aircraft runtime loader verification passed: active trainer prefers the authored aircraft, preserves its materials and gear, isolates fallback livery, propagates capture metadata, and enforces dimensions.");
