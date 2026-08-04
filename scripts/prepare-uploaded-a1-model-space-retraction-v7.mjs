import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const modeAuthority = "model-space-toward-measured-rotunda-v7";
let source = fs.readFileSync(fleetPath, "utf8");

const oldRetraction = 'const A1_RETRACTION = Object.freeze({ rotation: 0.052, tunnelB: 0.42, tunnelC: 0.78, cab: 1.18, lift: 0.08, totalClearanceMeters: 2.38 });';
const newRetraction = `const A1_RETRACTION = Object.freeze({ rotation: 0, tunnelB: 0.79, tunnelC: 1.59, cab: 2.38, lift: 0.08, totalClearanceMeters: 2.38 });
const A1_RETRACTION_MODE = "${modeAuthority}";`;

const controllerStartToken = "function createController() {";
const controllerEndToken = "\nfunction hideGeneratedJetways";
const controllerFactoryToken = "const controller = createController();";
const controllerFactoryReplacement = "const controller = createController(THREE);";

const controllerReplacement = `function restoreLocalMatrix(object, matrix) {
  matrix.decompose(object.position, object.quaternion, object.scale);
  object.updateMatrix();
}

function applyModelSpaceRetraction(THREE, model, object, baseLocalMatrix, direction, distance, lift = 0) {
  if (!object) return;
  restoreLocalMatrix(object, baseLocalMatrix);
  model.updateWorldMatrix(true, true);
  const modelInverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const objectInModel = new THREE.Matrix4().multiplyMatrices(modelInverse, object.matrixWorld);
  const parentInModel = new THREE.Matrix4().multiplyMatrices(modelInverse, object.parent.matrixWorld);
  const correction = new THREE.Matrix4().makeTranslation(
    direction.x * distance,
    lift,
    direction.z * distance,
  );
  const correctedInModel = new THREE.Matrix4().multiplyMatrices(correction, objectInModel);
  const local = new THREE.Matrix4().multiplyMatrices(parentInModel.clone().invert(), correctedInModel);
  local.decompose(object.position, object.quaternion, object.scale);
  object.updateMatrix();
  model.updateWorldMatrix(true, true);
}

function measureRetractionDirection(THREE, model) {
  const rotunda = findSourcePartRoot(model, "Rotunda");
  const cab = findSourcePartRoot(model, "Cab");
  if (!rotunda || !cab) throw new Error("Supplied A1 retraction requires Rotunda and Cab");
  model.updateWorldMatrix(true, true);
  const rotundaWorld = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
  const cabWorld = new THREE.Box3().setFromObject(cab).getCenter(new THREE.Vector3());
  const rotundaModel = model.worldToLocal(rotundaWorld.clone());
  const cabModel = model.worldToLocal(cabWorld.clone());
  const direction = rotundaModel.sub(cabModel);
  direction.y = 0;
  if (direction.lengthSq() < 0.01) throw new Error("Supplied A1 retraction direction is degenerate");
  return direction.normalize();
}

function createController(THREE) {
  let deployment = 1;
  let visual = null;
  let state = "loading-uploaded-model";

  const apply = () => {
    if (!visual) return;
    const retract = 1 - deployment;
    const { anchor, model, nodes, base, direction } = visual;
    anchor.rotation.y = base.yaw;
    anchor.updateMatrix();
    for (const [name, node] of Object.entries(nodes)) {
      if (node) restoreLocalMatrix(node, base[name]);
    }
    model.updateWorldMatrix(true, true);
    applyModelSpaceRetraction(THREE, model, nodes.tunnelB, base.tunnelB, direction, retract * A1_RETRACTION.tunnelB);
    applyModelSpaceRetraction(THREE, model, nodes.tunnelC, base.tunnelC, direction, retract * A1_RETRACTION.tunnelC);
    applyModelSpaceRetraction(
      THREE,
      model,
      nodes.cab,
      base.cab,
      direction,
      retract * A1_RETRACTION.cab,
      retract * A1_RETRACTION.lift,
    );
    anchor.userData.retractionAuthority = A1_RETRACTION_AUTHORITY;
    anchor.userData.retractionClearanceMeters = A1_RETRACTION.totalClearanceMeters;
    anchor.userData.retractionMode = A1_RETRACTION_MODE;
    anchor.userData.retractionDirectionModel = direction.toArray().join(",");
    state = deployment >= 0.995 ? "attached-to-aircraft-door"
      : deployment <= 0.005 ? "parked-clear-of-aircraft"
        : "retracting-from-aircraft";
  };

  return {
    setDeployment(value) {
      deployment = clamp(value, 0, 1);
      apply();
    },
    getDeployment() { return deployment; },
    getState() { return state; },
    bind(anchor) {
      const model = anchor.getObjectByName("UploadedAirportJetwayModel_A1");
      const nodes = {
        tunnelB: findSourcePartRoot(model, "Tunnel_B"),
        tunnelC: findSourcePartRoot(model, "Tunnel_C"),
        cab: findSourcePartRoot(model, "Cab"),
      };
      for (const node of Object.values(nodes)) node?.updateMatrix();
      const direction = measureRetractionDirection(THREE, model);
      visual = {
        anchor,
        model,
        nodes,
        direction,
        base: {
          yaw: anchor.rotation.y,
          tunnelB: nodes.tunnelB?.matrix.clone() || new THREE.Matrix4(),
          tunnelC: nodes.tunnelC?.matrix.clone() || new THREE.Matrix4(),
          cab: nodes.cab?.matrix.clone() || new THREE.Matrix4(),
        },
      };
      state = "uploaded-model-ready";
      apply();
    },
  };
}
`;

if (!source.includes(modeAuthority)) {
  if (!source.includes(oldRetraction)) {
    throw new Error(`${fleetPath}: legacy A1 retraction constants are missing`);
  }
  const controllerStart = source.indexOf(controllerStartToken);
  const controllerEnd = source.indexOf(controllerEndToken, controllerStart + controllerStartToken.length);
  if (controllerStart < 0 || controllerEnd < 0 || controllerEnd <= controllerStart) {
    throw new Error(`${fleetPath}: legacy A1 retraction controller block is missing`);
  }
  if (!source.includes(controllerFactoryToken)) {
    throw new Error(`${fleetPath}: legacy A1 controller factory call is missing`);
  }

  source = source.replace(oldRetraction, newRetraction);
  source = `${source.slice(0, controllerStart)}${controllerReplacement}${source.slice(controllerEnd)}`;
  source = source.replace(controllerFactoryToken, controllerFactoryReplacement);
  fs.writeFileSync(fleetPath, source, "utf8");
}

source = fs.readFileSync(fleetPath, "utf8");
for (const token of [
  modeAuthority,
  "function applyModelSpaceRetraction",
  "function measureRetractionDirection",
  "direction.x * distance",
  "direction.z * distance",
  "tunnelB: 0.79",
  "tunnelC: 1.59",
  "cab: 2.38",
  "const controller = createController(THREE);",
  "anchor.userData.retractionDirectionModel",
]) {
  if (!source.includes(token)) throw new Error(`${fleetPath}: model-space A1 retraction is missing ${token}`);
}
if (source.includes("base.yaw - retract * A1_RETRACTION.rotation")) {
  throw new Error(`${fleetPath}: retired A1 yaw-sweep retraction is still active`);
}

console.log("Prepared supplied A1 model-space retraction toward the measured Rotunda: B 0.79 m, C 1.59 m, Cab 2.38 m, no yaw sweep.");
