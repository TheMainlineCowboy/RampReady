import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const modeAuthority = "model-space-toward-measured-rotunda-v7";
let source = fs.readFileSync(fleetPath, "utf8");

const oldRetraction = 'const A1_RETRACTION = Object.freeze({ rotation: 0.052, tunnelB: 0.42, tunnelC: 0.78, cab: 1.18, lift: 0.08, totalClearanceMeters: 2.38 });';
const newRetraction = `const A1_RETRACTION = Object.freeze({ rotation: 0, tunnelB: 0.79, tunnelC: 1.59, cab: 2.38, lift: 0.08, totalClearanceMeters: 2.38 });
const A1_RETRACTION_MODE = "${modeAuthority}";`;
const insertionToken = "\nfunction hideGeneratedJetways";
const controllerFactoryToken = "const controller = createController();";
const controllerFactoryReplacement = "const controller = createModelSpaceController(THREE);";

const measuredController = `
function restoreA1LocalMatrix(object, matrix) {
  matrix.decompose(object.position, object.quaternion, object.scale);
  object.updateMatrix();
}

function applyA1ModelSpaceRetraction(THREE, model, object, baseLocalMatrix, direction, distance, lift = 0) {
  if (!object) return;
  restoreA1LocalMatrix(object, baseLocalMatrix);
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

function measureA1RetractionDirection(THREE, model) {
  const rotunda = model?.getObjectByName?.("Rotunda");
  const cab = model?.getObjectByName?.("Cab");
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

function createModelSpaceController(THREE) {
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
      if (node) restoreA1LocalMatrix(node, base[name]);
    }
    model.updateWorldMatrix(true, true);
    applyA1ModelSpaceRetraction(
      THREE,
      model,
      nodes.tunnelB,
      base.tunnelB,
      direction,
      retract * A1_RETRACTION.tunnelB,
    );
    applyA1ModelSpaceRetraction(
      THREE,
      model,
      nodes.tunnelC,
      base.tunnelC,
      direction,
      retract * A1_RETRACTION.tunnelC,
    );
    applyA1ModelSpaceRetraction(
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
        tunnelB: model?.getObjectByName?.("Tunnel_B"),
        tunnelC: model?.getObjectByName?.("Tunnel_C"),
        cab: model?.getObjectByName?.("Cab"),
      };
      if (!model || !nodes.tunnelB || !nodes.tunnelC || !nodes.cab) {
        throw new Error("Supplied A1 model-space retraction is missing the fitted model hierarchy");
      }
      for (const node of Object.values(nodes)) node.updateMatrix();
      const direction = measureA1RetractionDirection(THREE, model);
      visual = {
        anchor,
        model,
        nodes,
        direction,
        base: {
          yaw: anchor.rotation.y,
          tunnelB: nodes.tunnelB.matrix.clone(),
          tunnelC: nodes.tunnelC.matrix.clone(),
          cab: nodes.cab.matrix.clone(),
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
  if (!source.includes(controllerFactoryToken)) {
    throw new Error(`${fleetPath}: legacy A1 controller factory call is missing`);
  }

  // Replace the constants first, then calculate the insertion index against the
  // updated source. The replacement adds a line; reusing an index measured from
  // the shorter legacy source inserts the new controller inside createController.
  source = source.replace(oldRetraction, newRetraction);
  const insertionIndex = source.indexOf(insertionToken);
  if (insertionIndex < 0) {
    throw new Error(`${fleetPath}: A1 controller insertion anchor is missing`);
  }
  source = `${source.slice(0, insertionIndex)}${measuredController}${source.slice(insertionIndex)}`;
  source = source.replace(controllerFactoryToken, controllerFactoryReplacement);
  fs.writeFileSync(fleetPath, source, "utf8");
}

source = fs.readFileSync(fleetPath, "utf8");
for (const token of [
  modeAuthority,
  "function applyA1ModelSpaceRetraction",
  "function measureA1RetractionDirection",
  "function createModelSpaceController",
  "direction.x * distance",
  "direction.z * distance",
  "tunnelB: 0.79",
  "tunnelC: 1.59",
  "cab: 2.38",
  "const controller = createModelSpaceController(THREE);",
  "anchor.userData.retractionDirectionModel",
]) {
  if (!source.includes(token)) throw new Error(`${fleetPath}: model-space A1 retraction is missing ${token}`);
}

// The complete generated controller must sit immediately before the next
// top-level function. This catches the stale-index nesting bug even though the
// resulting JavaScript is syntactically valid.
if (!source.includes(`${measuredController}${insertionToken}`)) {
  throw new Error(`${fleetPath}: model-space A1 controller is not top-level before hideGeneratedJetways`);
}

console.log("Prepared supplied A1 model-space retraction toward the measured Rotunda: B 0.79 m, C 1.59 m, Cab 2.38 m, no yaw sweep.");
