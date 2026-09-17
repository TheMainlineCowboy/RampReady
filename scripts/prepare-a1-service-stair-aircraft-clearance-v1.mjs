import fs from "node:fs";

const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-service-stair-aircraft-clearance-v1";
let source = fs.readFileSync(doorFitPath, "utf8");

if (!source.includes(marker)) {
  const resolverAnchor = "function restoreUnarticulatedSource(model) {";
  if (!source.includes(resolverAnchor)) {
    throw new Error(`${doorFitPath}: A1 service-stair clearance cannot find the source-restore anchor`);
  }

  const helperBlock = `// ${marker}\nfunction resolveA1ServiceStairMesh(model) {\n  const exactNameMatches = [];\n  const materialMatches = [];\n  model.traverse((entry) => {\n    if (!entry?.isMesh || entry.visible === false || !entry.geometry?.getAttribute?.("position")) return;\n    const name = String(entry.name || "");\n    const materialName = Array.isArray(entry.material)\n      ? entry.material.map((material) => material?.name || "").join(" ")\n      : String(entry.material?.name || "");\n    if (/Tunnel_C_GalvanizedServiceStair_SourceTriangles/i.test(name)) exactNameMatches.push(entry);\n    if (/galvanized.*stair|stair.*rail/i.test(materialName)) materialMatches.push(entry);\n  });\n  const candidates = exactNameMatches.length ? exactNameMatches : materialMatches;\n  const unique = [...new Set(candidates)];\n  if (unique.length !== 1) {\n    throw new Error(\`Supplied A1 service-stair clearance requires exactly one separable authored stair mesh; found \${unique.length}: \${unique.map((entry) => entry.name || "unnamed").join(", ")}\`);\n  }\n  return unique[0];\n}\n\nfunction measureMaximumAircraftPlanePenetration(THREE, model, object, targetWorld, inwardNormalWorld) {\n  const vertices = collectModelLocalVertices(THREE, model, object);\n  let maximum = Number.NEGATIVE_INFINITY;\n  for (const vertex of vertices) {\n    const worldVertex = model.localToWorld(vertex.clone());\n    const penetration = worldVertex.sub(targetWorld).dot(inwardNormalWorld);\n    maximum = Math.max(maximum, penetration);\n  }\n  return maximum;\n}\n\nfunction keepA1ServiceStairClearOfAircraft(THREE, model, stair, targetWorld, inwardNormalWorld) {\n  // The Cab hood is allowed to meet the door plane; the service stair is not.\n  // Preserve every supplied stair vertex/material and move only that rigid source\n  // subset outward in the apron plane when its authored pose enters the CRJ skin.\n  const targetMaximumPenetrationMeters = -0.12;\n  const beforeMaximumPenetrationMeters = measureMaximumAircraftPlanePenetration(\n    THREE, model, stair, targetWorld, inwardNormalWorld,\n  );\n  const requiredOutwardShiftMeters = Math.max(\n    0,\n    beforeMaximumPenetrationMeters - targetMaximumPenetrationMeters,\n  );\n  if (!(requiredOutwardShiftMeters <= 2.0)) {\n    throw new Error(\`Supplied A1 service stair would require an implausible aircraft-clearance shift: penetration=\${beforeMaximumPenetrationMeters}, shift=\${requiredOutwardShiftMeters}\`);\n  }\n  if (requiredOutwardShiftMeters > 0.001) {\n    model.updateWorldMatrix(true, true);\n    const worldOrigin = model.localToWorld(new THREE.Vector3(0, 0, 0));\n    const shiftedWorld = worldOrigin.clone().addScaledVector(inwardNormalWorld, -requiredOutwardShiftMeters);\n    const localOrigin = model.worldToLocal(worldOrigin.clone());\n    const shiftedLocal = model.worldToLocal(shiftedWorld);\n    const modelSpaceShift = shiftedLocal.sub(localOrigin);\n    applyModelSpaceMatrix(\n      THREE, model, stair,\n      translationMatrix(THREE, modelSpaceShift.x, 0, modelSpaceShift.z),\n    );\n  }\n  model.updateWorldMatrix(true, true);\n  const afterMaximumPenetrationMeters = measureMaximumAircraftPlanePenetration(\n    THREE, model, stair, targetWorld, inwardNormalWorld,\n  );\n  if (!(afterMaximumPenetrationMeters <= targetMaximumPenetrationMeters + 0.03)) {\n    throw new Error(\`Supplied A1 service stair still crosses the CRJ door/fuselage plane after correction: before=\${beforeMaximumPenetrationMeters}, after=\${afterMaximumPenetrationMeters}\`);\n  }\n  return Object.freeze({\n    authority: "${marker}",\n    beforeMaximumPenetrationMeters,\n    afterMaximumPenetrationMeters,\n    outwardShiftMeters: requiredOutwardShiftMeters,\n    targetMaximumPenetrationMeters,\n  });\n}\n\n`;
  source = source.replace(resolverAnchor, `${helperBlock}${resolverAnchor}`);

  const normalAnchor = `  const actualCabNormalWorld = cabFacingDirection.clone()\n    .transformDirection(model.matrixWorld).setY(0).normalize();`;
  if (!source.includes(normalAnchor)) {
    throw new Error(`${doorFitPath}: A1 service-stair clearance cannot find the final horizontal Cab-normal anchor`);
  }
  const normalWithClearance = `${normalAnchor}\n  const serviceStair = resolveA1ServiceStairMesh(model);\n  const serviceStairAircraftClearance = keepA1ServiceStairClearOfAircraft(\n    THREE, model, serviceStair, targetWorld, desiredCabNormalWorld,\n  );`;
  source = source.replace(normalAnchor, normalWithClearance);

  // Keep the legacy penetration->contactWidth sequence adjacent because the late
  // final-visible normalizer replaces that exact pair when it adds hood-footprint
  // telemetry. Publish stair clearance immediately after contactWidth instead.
  const resultAnchor = `    cabFuselagePenetrationMeters,\n    contactWidthMeters: cabAssembly.contactWidth,`;
  if (!source.includes(resultAnchor)) {
    throw new Error(`${doorFitPath}: A1 service-stair clearance cannot find the V11 result telemetry anchor`);
  }
  source = source.replace(
    resultAnchor,
    `${resultAnchor}\n    serviceStairAircraftClearance,`,
  );

  const userDataAnchor = `  group.userData.uploadedJetwayA1DoorFitCabFuselagePenetrationMeters = cabFuselagePenetrationMeters;`;
  if (!source.includes(userDataAnchor)) {
    throw new Error(`${doorFitPath}: A1 service-stair clearance cannot find the V11 userData telemetry anchor`);
  }
  source = source.replace(
    userDataAnchor,
    `${userDataAnchor}\n  group.userData.uploadedJetwayA1ServiceStairClearanceAuthority = serviceStairAircraftClearance.authority;\n  group.userData.uploadedJetwayA1ServiceStairBeforePenetrationMeters = serviceStairAircraftClearance.beforeMaximumPenetrationMeters;\n  group.userData.uploadedJetwayA1ServiceStairAfterPenetrationMeters = serviceStairAircraftClearance.afterMaximumPenetrationMeters;\n  group.userData.uploadedJetwayA1ServiceStairOutwardShiftMeters = serviceStairAircraftClearance.outwardShiftMeters;`,
  );
}

for (const required of [
  marker,
  "resolveA1ServiceStairMesh",
  "keepA1ServiceStairClearOfAircraft",
  "targetMaximumPenetrationMeters = -0.12",
  "requiredOutwardShiftMeters <= 2.0",
  "uploadedJetwayA1ServiceStairAfterPenetrationMeters",
  "contactWidthMeters: cabAssembly.contactWidth,\n    serviceStairAircraftClearance",
]) {
  if (!source.includes(required)) throw new Error(`${doorFitPath}: A1 service-stair clearance is missing ${required}`);
}

fs.writeFileSync(doorFitPath, source, "utf8");
console.log(`Prepared ${marker}: the exact supplied Tunnel-C service-stair triangle subset remains intact and is rigidly kept outside the CRJ fuselage contact plane while Cab door contact and bogie grounding remain unchanged.`);
