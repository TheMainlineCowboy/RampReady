import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { installA1SimulatorApron } from "./a1SimulatorApron.js";
import concourseA from "./kphxV181/concourseA.js";

export const STATIC_RAMP_EQUIPMENT_PROFILE = Object.freeze({
  tugGates: Object.freeze(["A2", "A4", "A6"]),
  conedGates: Object.freeze(["A2", "A3", "A4", "A5", "A6", "A7", "A8"]),
  tugSource: "models/standup-tug.glb",
  sceneOffsetZ: 6.2,
  detailLevel: "authored-standup-ramp-equipment-and-cones-v1",
});

function gateByName(name) {
  const gate = concourseA.parkings.find((parking) => parking.g === name);
  if (!gate) throw new Error(`Ramp equipment gate ${name} is missing from KPHX source parking records`);
  return gate;
}

function applyPiedmontFinish(THREE, scene) {
  const piedmontRed = new THREE.Color(0xd01f2d);
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const originals = Array.isArray(node.material) ? node.material : [node.material];
    const materials = originals.map((original) => {
      const material = original?.clone?.() ?? new THREE.MeshStandardMaterial();
      const brightness = material.color ? (material.color.r + material.color.g + material.color.b) / 3 : 1;
      if (material.color && (material.map || brightness > 0.42)) material.color.lerp(piedmontRed, material.map ? 0.92 : 0.84);
      material.roughness = Math.max(0.5, material.roughness ?? 0.5);
      material.needsUpdate = true;
      return material;
    });
    node.material = Array.isArray(node.material) ? materials : materials[0];
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
    node.userData.staticRampEquipment = true;
  });
}

function gateFrame(gate) {
  const yaw = (270 - gate.h) * Math.PI / 180;
  const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  return { yaw, forward, right };
}

function buildSafetyCone(THREE) {
  const group = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xf06a1a, roughness: 0.82, metalness: 0.02 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f1e8, roughness: 0.86, metalness: 0.01 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.94, metalness: 0 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.42), rubber);
  base.position.y = 0.028;
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.17, 0.38, 18), orange);
  lower.position.y = 0.27;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 0.095, 18), white);
  band.position.y = 0.39;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.06, 0.24, 18), orange);
  tip.position.y = 0.555;
  for (const mesh of [base, lower, band, tip]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.name = "PHX_RampSafetyCone";
  return group;
}

function addGateCones(THREE, group, gate) {
  const { yaw, forward, right } = gateFrame(gate);
  const patterns = [
    { forward: -7.2, right: -9.3 },
    { forward: -7.2, right: 9.3 },
    { forward: 8.4, right: -8.8 },
    { forward: 8.4, right: 8.8 },
  ];
  for (const offset of patterns) {
    const cone = buildSafetyCone(THREE);
    cone.position.set(
      gate.x + forward.x * offset.forward + right.x * offset.right,
      0.045,
      gate.z + STATIC_RAMP_EQUIPMENT_PROFILE.sceneOffsetZ + forward.z * offset.forward + right.z * offset.right,
    );
    cone.rotation.y = yaw;
    cone.userData.gate = gate.g;
    group.add(cone);
  }
}

export async function installStaticRampEquipment(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required for static ramp equipment");
  const url = `${import.meta.env.BASE_URL}${STATIC_RAMP_EQUIPMENT_PROFILE.tugSource}`;
  const [{ scene: tugTemplate }, apron] = await Promise.all([
    new GLTFLoader().loadAsync(url),
    installA1SimulatorApron(THREE, environment),
  ]);
  applyPiedmontFinish(THREE, tugTemplate);

  const group = new THREE.Group();
  group.name = "PHX_StaticRampEquipmentPopulation";
  for (const gateName of STATIC_RAMP_EQUIPMENT_PROFILE.tugGates) {
    const gate = gateByName(gateName);
    const { yaw, forward, right } = gateFrame(gate);
    const tug = tugTemplate.clone(true);
    const distanceFromRoot = 12.5;
    tug.position.set(
      gate.x + forward.x * distanceFromRoot + right.x * 2.4,
      0.04,
      gate.z + STATIC_RAMP_EQUIPMENT_PROFILE.sceneOffsetZ + forward.z * distanceFromRoot + right.z * 2.4,
    );
    tug.rotation.y = yaw + Math.PI;
    tug.name = `PHX_StaticStandup_${gate.g}`;
    tug.userData.gate = gate.g;
    tug.userData.placementAuthority = "decoded KPHX ADEX parking frame";
    group.add(tug);
  }
  for (const gateName of STATIC_RAMP_EQUIPMENT_PROFILE.conedGates) addGateCones(THREE, group, gateByName(gateName));

  group.userData.authoredTugCount = STATIC_RAMP_EQUIPMENT_PROFILE.tugGates.length;
  group.userData.safetyConeCount = STATIC_RAMP_EQUIPMENT_PROFILE.conedGates.length * 4;
  group.userData.totalObjectCount = group.children.length;
  group.userData.detailLevel = STATIC_RAMP_EQUIPMENT_PROFILE.detailLevel;
  group.userData.apronDetailLevel = apron.userData.detailLevel;
  group.userData.apronTextureResolution = apron.userData.textureResolution;
  environment.add(group);
  environment.userData.staticRampEquipment = group;
  environment.userData.staticRampAuthoredTugCount = group.userData.authoredTugCount;
  environment.userData.staticRampSafetyConeCount = group.userData.safetyConeCount;
  environment.userData.staticRampEquipmentObjectCount = group.userData.totalObjectCount;
  environment.userData.staticRampEquipmentDetailLevel = group.userData.detailLevel;
  environment.userData.staticRampApronDetailLevel = group.userData.apronDetailLevel;
  environment.userData.staticRampApronTextureResolution = group.userData.apronTextureResolution;
  return group;
}
