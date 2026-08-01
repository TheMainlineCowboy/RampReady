import * as THREE from "three";

const A1_ROTUNDA = Object.freeze({ x: -21.01, y: 4.35, z: -16.15 });
const A1_SOURCE_PORTAL = Object.freeze({ x: -30.16857013, y: 4.35, z: -16.15 });
const PORTAL_OVERLAP_METERS = 0.8;
const AUTHORITY = "exact-T4_WALK-source-shell-overlap-and-framed-portal-v37";

function createArchedPortalGeometry(width, height, roofRise, depth) {
  const shape = new THREE.Shape();
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const shoulder = halfHeight - roofRise;
  shape.moveTo(-halfWidth, -halfHeight);
  shape.lineTo(-halfWidth, shoulder);
  shape.quadraticCurveTo(-halfWidth * 0.82, halfHeight, 0, halfHeight);
  shape.quadraticCurveTo(halfWidth * 0.82, halfHeight, halfWidth, shoulder);
  shape.lineTo(halfWidth, -halfHeight);
  shape.closePath();

  const shellThickness = 0.13;
  const innerHalfWidth = halfWidth - shellThickness;
  const innerHalfHeight = halfHeight - shellThickness;
  const innerShoulder = innerHalfHeight - Math.max(0.16, roofRise - shellThickness * 0.35);
  const opening = new THREE.Path();
  // Reverse the winding from the outer arch so ExtrudeGeometry creates a real
  // hollow corridor shell rather than a solid cap at the Terminal 4 doorway.
  opening.moveTo(-innerHalfWidth, -innerHalfHeight);
  opening.lineTo(innerHalfWidth, -innerHalfHeight);
  opening.lineTo(innerHalfWidth, innerShoulder);
  opening.quadraticCurveTo(innerHalfWidth * 0.82, innerHalfHeight, 0, innerHalfHeight);
  opening.quadraticCurveTo(-innerHalfWidth * 0.82, innerHalfHeight, -innerHalfWidth, innerShoulder);
  opening.closePath();
  shape.holes.push(opening);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 10,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const nx = Math.abs(normal.getX(index));
    const ny = Math.abs(normal.getY(index));
    const nz = Math.abs(normal.getZ(index));
    const shell = nz < 0.72 && (nx > 0.35 || ny > 0.2);
    uv[index * 2] = shell ? z / depth + 0.5 : x / width + 0.5;
    uv[index * 2 + 1] = shell && ny > nx ? x / width + 0.5 : y / height + 0.5;
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.userData.sourceAuthority = AUTHORITY;
  geometry.userData.hollowPortalShell = true;
  geometry.userData.shellThicknessMeters = shellThickness;
  return geometry;
}

function makeMesh(name, material, scale, position) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.name = name;
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function installA1TerminalPortalSealV37(jetwayGroup) {
  if (!jetwayGroup?.isGroup) throw new Error("A1 terminal portal seal requires the Terminal 4 jetway group");
  const existing = jetwayGroup.getObjectByName("A1_T4_WALK_TerminalPortalSeal_V37");
  if (existing) return existing;

  const wallCollars = jetwayGroup.getObjectByName("AIR_Jetway01_WallCollars")
    || jetwayGroup.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  const sourceMaterial = Array.isArray(wallCollars?.material) ? wallCollars.material[0] : wallCollars?.material;
  if (!sourceMaterial) throw new Error("A1 terminal portal seal could not find the exact-source fixed-corridor material");

  const root = new THREE.Group();
  root.name = "A1_T4_WALK_TerminalPortalSeal_V37";

  const towardTerminal = new THREE.Vector3(
    A1_SOURCE_PORTAL.x - A1_ROTUNDA.x,
    0,
    A1_SOURCE_PORTAL.z - A1_ROTUNDA.z,
  ).normalize();
  const yaw = Math.atan2(towardTerminal.x, towardTerminal.z);
  const sealDepth = 1.6;
  const sealCenter = new THREE.Vector3(A1_SOURCE_PORTAL.x, A1_SOURCE_PORTAL.y, A1_SOURCE_PORTAL.z)
    .addScaledVector(towardTerminal, PORTAL_OVERLAP_METERS - sealDepth / 2);

  const shellMaterial = sourceMaterial.clone();
  shellMaterial.name = "A1 exact M1DGJETWAY hollow terminal portal overlap shell V37";
  shellMaterial.userData = {
    ...(shellMaterial.userData || {}),
    a1TerminalPortalAuthority: AUTHORITY,
    sourcePortal: "T4_WALK",
    hollowPortalShell: true,
  };
  const shell = new THREE.Mesh(createArchedPortalGeometry(2.72, 2.54, 0.3, sealDepth), shellMaterial);
  shell.name = "A1_T4_WALK_SourceTexturedOverlapShell_V37";
  shell.position.copy(sealCenter);
  shell.rotation.y = yaw;
  shell.castShadow = true;
  shell.receiveShadow = true;
  root.add(shell);

  const trim = new THREE.MeshStandardMaterial({
    name: "A1 T4_WALK galvanized portal frame V37",
    color: 0x6f777a,
    roughness: 0.62,
    metalness: 0.34,
  });
  const threshold = trim.clone();
  threshold.name = "A1 T4_WALK yellow portal threshold V37";
  threshold.color.setHex(0xcda01e);
  threshold.roughness = 0.74;
  threshold.metalness = 0.08;
  const interior = new THREE.MeshStandardMaterial({
    name: "A1 T4_WALK interior doorway V37",
    color: 0x182126,
    emissive: 0x071014,
    emissiveIntensity: 0.1,
    roughness: 0.84,
    metalness: 0.02,
  });

  const frame = new THREE.Group();
  frame.name = "A1_T4_WALK_PortalFrame_V37";
  frame.position.set(A1_SOURCE_PORTAL.x, A1_SOURCE_PORTAL.y, A1_SOURCE_PORTAL.z);
  frame.rotation.y = yaw;
  frame.add(makeMesh("A1_T4_WALK_LeftJamb_V37", trim, [0.16, 2.42, 0.24], [-1.29, 0, -0.04]));
  frame.add(makeMesh("A1_T4_WALK_RightJamb_V37", trim, [0.16, 2.42, 0.24], [1.29, 0, -0.04]));
  frame.add(makeMesh("A1_T4_WALK_Header_V37", trim, [2.74, 0.18, 0.26], [0, 1.23, -0.04]));
  frame.add(makeMesh("A1_T4_WALK_Threshold_V37", threshold, [2.58, 0.12, 0.34], [0, -1.21, -0.02]));
  frame.add(makeMesh("A1_T4_WALK_Interior_V37", interior, [2.34, 2.12, 0.05], [0, -0.04, 0.58]));
  root.add(frame);

  root.userData.authority = AUTHORITY;
  root.userData.sourcePortal = "T4_WALK";
  root.userData.sourcePortalPosition = [A1_SOURCE_PORTAL.x, A1_SOURCE_PORTAL.y, A1_SOURCE_PORTAL.z];
  root.userData.rotundaPosition = [A1_ROTUNDA.x, A1_ROTUNDA.y, A1_ROTUNDA.z];
  root.userData.portalOverlapMeters = PORTAL_OVERLAP_METERS;
  root.userData.hollowPortalShell = true;
  root.userData.usesExactRecoveredJetwayTexture = Boolean(shellMaterial.map);
  jetwayGroup.add(root);

  jetwayGroup.userData.a1TerminalPortalSealAuthority = AUTHORITY;
  jetwayGroup.userData.a1TerminalPortalSealOverlapMeters = PORTAL_OVERLAP_METERS;
  jetwayGroup.userData.a1TerminalPortalSealExactTexture = Boolean(shellMaterial.map);
  jetwayGroup.userData.a1TerminalPortalSealHollow = true;
  return root;
}
