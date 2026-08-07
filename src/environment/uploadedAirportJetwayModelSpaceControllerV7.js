function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function restoreLocalMatrix(object, matrix) {
  matrix.decompose(object.position, object.quaternion, object.scale);
  object.updateMatrix();
}

function applyModelSpaceRetraction(
  THREE,
  model,
  object,
  baseLocalMatrix,
  direction,
  distance,
  lift = 0,
) {
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

export function createModelSpaceA1Controller(THREE, {
  retraction,
  authority,
  modeAuthority,
} = {}) {
  if (!THREE) throw new Error("THREE is required for supplied A1 model-space retraction");
  if (!retraction || !(retraction.cab > 0)) {
    throw new Error("Supplied A1 model-space retraction requires positive travel limits");
  }

  let deployment = 1;
  let requestedAttachedVerticalDrop = 0;
  let visual = null;
  let state = "loading-uploaded-model";

  const apply = () => {
    if (!visual) return;
    const retract = 1 - deployment;
    const { anchor, model, nodes, base, direction } = visual;

    // The airport-placement pipeline may rotate and relocate the complete A1
    // parent after this controller binds to the supplied GLB. Retraction owns
    // only the authored telescoping child transforms. Never restore the parent
    // yaw captured at bind time: doing so would undo the final Terminal 4 wall
    // registration whenever inspection/training calls setDeployment().
    anchor.updateMatrix();
    anchor.updateWorldMatrix(true, true);
    for (const [name, node] of Object.entries(nodes)) {
      if (node) restoreLocalMatrix(node, base[name]);
    }
    model.updateWorldMatrix(true, true);

    // Attached deployment must preserve the authored grounded assembly. The
    // former progressive attachedDrop lifted Tunnel B, Tunnel C and Cab after
    // the fleet had been grounded, carrying the authored bogie and wheels into
    // the air. Retraction remains model-space horizontal movement; only the
    // existing parked-state clearance lift is retained while retracting.
    applyModelSpaceRetraction(
      THREE,
      model,
      nodes.tunnelB,
      base.tunnelB,
      direction,
      retract * retraction.tunnelB,
      0,
    );
    applyModelSpaceRetraction(
      THREE,
      model,
      nodes.tunnelC,
      base.tunnelC,
      direction,
      retract * retraction.tunnelC,
      0,
    );
    applyModelSpaceRetraction(
      THREE,
      model,
      nodes.cab,
      base.cab,
      direction,
      retract * retraction.cab,
      retract * retraction.lift,
    );
    anchor.userData.retractionAuthority = authority;
    anchor.userData.retractionClearanceMeters = retraction.totalClearanceMeters;
    anchor.userData.retractionMode = modeAuthority;
    anchor.userData.retractionDirectionModel = direction.toArray().join(",");
    anchor.userData.retractionParentPoseAuthority = "preserve-final-airport-placement-v8";
    anchor.userData.requestedAttachedVerticalDropMeters = requestedAttachedVerticalDrop;
    anchor.userData.attachedVerticalDropMeters = 0;
    anchor.userData.attachedVerticalFitAuthority = "grounded-jetway-door-gap-reported-no-child-lift-v1";
    anchor.userData.authoredBogieGroundPreserved = true;
    state = deployment >= 0.995 ? "attached-to-aircraft-door"
      : deployment <= 0.005 ? "parked-clear-of-aircraft"
        : "retracting-from-aircraft";
  };

  return {
    setDeployment(value) {
      deployment = clamp(value, 0, 1);
      apply();
    },
    setAttachedVerticalDrop(value) {
      requestedAttachedVerticalDrop = clamp(value, -6, 2);
      apply();
      return 0;
    },
    getAttachedVerticalDrop() { return 0; },
    getRequestedAttachedVerticalDrop() { return requestedAttachedVerticalDrop; },
    getDeployment() { return deployment; },
    getState() { return state; },
    bind(anchor) {
      const model = anchor?.getObjectByName?.("UploadedAirportJetwayModel_A1");
      const nodes = {
        tunnelB: model?.getObjectByName?.("Tunnel_B"),
        tunnelC: model?.getObjectByName?.("Tunnel_C"),
        cab: model?.getObjectByName?.("Cab"),
      };
      if (!model || !nodes.tunnelB || !nodes.tunnelC || !nodes.cab) {
        throw new Error("Supplied A1 model-space retraction is missing the fitted model hierarchy");
      }
      for (const node of Object.values(nodes)) node.updateMatrix();
      const direction = measureRetractionDirection(THREE, model);
      visual = {
        anchor,
        model,
        nodes,
        direction,
        base: {
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

export const A1_MODEL_SPACE_RETRACTION_MODE_V7 = "model-space-toward-measured-rotunda-v7";
