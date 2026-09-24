import {
  AUTOGATE_REFERENCE,
  getAutoGateDoorTargets,
  getRampReadyAircraftDoorProfile,
} from "./aircraftDoorAuthority.js";

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const lerp = (a, b, t) => a + (b - a) * t;
const radians = (degrees) => degrees * Math.PI / 180;

// User-supplied MisterX AutoGate-26m.obj horizontal articulation.
// A1's exact WED stock-facade reach is 23.860805 m, making the 26 m
// AutoGate bridge the closest supplied kinematic reference.
const AUTOGATE_26M = Object.freeze({
  sourceAsset: "MisterX_Library/Airport/Jetways-Steel/AutoGate-26m.obj",
  latRangeMeters: Object.freeze([0, 7.5]),
  bridgeYawDegrees: Object.freeze([58.87485095, 66.4785727]),
  cabinRelativeYawDegrees: Object.freeze([-60.6997204, -67.50015727]),
  sourceTranslationZMeters: Object.freeze([1, -6.5]),
  innerTunnelTranslationYMeters: Object.freeze([-0.64999994, -7.41999963]),
  vertRangeMeters: Object.freeze([-2, 0]),
  sourceBridgePitchDegreesAtMinus2: 3.99981854,
});

function linearCurve([a, b], valueMeters) {
  const t = clamp(valueMeters / AUTOGATE_26M.latRangeMeters[1], 0, 1);
  return lerp(a, b, t);
}

function solveFixedPivotPitchRadians({
  localY,
  localZ,
  baselinePitchRadians,
  verticalDeltaMeters,
}) {
  const radius = Math.hypot(localY, localZ);
  if (!(radius > 0.001)) {
    throw new Error("A1 exact moving bridge has no finite pivot-to-cabin radius");
  }

  // Keep the exact WED terminal-side hinge fixed. Solve the bridge pitch that
  // makes AutoGate's metre-space vert value appear at the aircraft-side cabin
  // joint instead of translating the entire bridge away from the rotunda.
  const baselineHeight =
    localY * Math.cos(baselinePitchRadians)
    - localZ * Math.sin(baselinePitchRadians);
  const targetHeight = baselineHeight + verticalDeltaMeters;
  if (Math.abs(targetHeight) > radius + 1e-6) {
    throw new Error(
      `A1 fixed-pivot pitch cannot reach vertical target ${verticalDeltaMeters.toFixed(4)} m`,
    );
  }

  const phase = Math.atan2(-localZ, localY);
  const offset = Math.acos(clamp(targetHeight / radius, -1, 1));
  const candidates = [phase + offset, phase - offset];

  const nearestEquivalent = (angle, reference) => {
    let value = angle;
    while (value - reference > Math.PI) value -= Math.PI * 2;
    while (value - reference < -Math.PI) value += Math.PI * 2;
    return value;
  };

  return candidates
    .map((angle) => nearestEquivalent(angle, baselinePitchRadians))
    .sort(
      (a, b) =>
        Math.abs(a - baselinePitchRadians)
        - Math.abs(b - baselinePitchRadians),
    )[0];
}

function rotate2(x, z, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c + z * s, z: -x * s + z * c };
}

function requireObject(root, name) {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`A1 exact jetway articulation is missing ${name}`);
  return object;
}

function splitExactLowerSupportComponents(THREE, aircraftTunnelVisual) {
  const sourceMeshes = [];
  aircraftTunnelVisual.traverse((node) => {
    if (node.isMesh && node.geometry?.getAttribute?.("position") && node.geometry?.getIndex?.()) {
      sourceMeshes.push(node);
    }
  });

  const supportBranches = [];
  let originalIndexCount = 0;
  let supportIndexCount = 0;
  let bridgeIndexCount = 0;

  const coordinateKey = (position, index) => {
    const q = (value) => Math.round(value * 10000);
    return `${q(position.getX(index))},${q(position.getY(index))},${q(position.getZ(index))}`;
  };

  for (const mesh of sourceMeshes) {
    const geometry = mesh.geometry;
    const position = geometry.getAttribute("position");
    const sourceIndex = geometry.getIndex();
    const source = Array.from(sourceIndex.array);
    if (source.length % 3 !== 0) {
      throw new Error("A1 exact stock tunnel index buffer is not triangular");
    }

    const triangleCount = source.length / 3;
    const parent = Array.from({ length: triangleCount }, (_, index) => index);
    const find = (value) => {
      let cursor = value;
      while (parent[cursor] !== cursor) {
        parent[cursor] = parent[parent[cursor]];
        cursor = parent[cursor];
      }
      return cursor;
    };
    const union = (left, right) => {
      const a = find(left);
      const b = find(right);
      if (a !== b) parent[b] = a;
    };

    const vertexToTriangles = new Map();
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const cursor = triangle * 3;
      for (const vertexIndex of [
        source[cursor],
        source[cursor + 1],
        source[cursor + 2],
      ]) {
        const key = coordinateKey(position, vertexIndex);
        const list = vertexToTriangles.get(key) || [];
        list.push(triangle);
        vertexToTriangles.set(key, list);
      }
    }
    for (const triangles of vertexToTriangles.values()) {
      for (let index = 1; index < triangles.length; index += 1) {
        union(triangles[0], triangles[index]);
      }
    }

    const components = new Map();
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const root = find(triangle);
      const list = components.get(root) || [];
      list.push(triangle);
      components.set(root, list);
    }

    const lowerSupportTriangles = new Set();
    for (const triangles of components.values()) {
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      let minZ = Number.POSITIVE_INFINITY;
      let maxZ = Number.NEGATIVE_INFINITY;
      const vertices = new Set();

      for (const triangle of triangles) {
        const cursor = triangle * 3;
        vertices.add(source[cursor]);
        vertices.add(source[cursor + 1]);
        vertices.add(source[cursor + 2]);
      }
      for (const vertexIndex of vertices) {
        const y = position.getY(vertexIndex);
        const z = position.getZ(vertexIndex);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }

      // Exact jw_tunnel_2_5b topology: the lower telescoping support/wheel
      // carriage is the connected source geometry centered on the support
      // station at local Z=3 m and ending at/below the lower-post top.
      // The upper posts extend to Y=3.4 m and therefore remain with the bridge.
      const isLowerSupport =
        minZ >= 2.35
        && maxZ <= 3.65
        && maxY <= 1.05;

      if (isLowerSupport) {
        for (const triangle of triangles) lowerSupportTriangles.add(triangle);
      }
    }

    if (!lowerSupportTriangles.size) continue;

    const bridgeIndices = [];
    const supportIndices = [];
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const target = lowerSupportTriangles.has(triangle)
        ? supportIndices
        : bridgeIndices;
      const cursor = triangle * 3;
      target.push(source[cursor], source[cursor + 1], source[cursor + 2]);
    }

    const IndexArray = sourceIndex.array.constructor;
    const bridgeGeometry = geometry.clone();
    bridgeGeometry.setIndex(
      new THREE.BufferAttribute(new IndexArray(bridgeIndices), 1),
    );
    bridgeGeometry.computeBoundingBox();
    bridgeGeometry.computeBoundingSphere();

    const supportGeometry = geometry.clone();
    supportGeometry.setIndex(
      new THREE.BufferAttribute(new IndexArray(supportIndices), 1),
    );
    supportGeometry.computeBoundingBox();
    supportGeometry.computeBoundingSphere();

    const supportMesh = mesh.clone(false);
    supportMesh.name = `${mesh.name}_A1ExactLowerSupport`;
    supportMesh.geometry = supportGeometry;
    supportMesh.material = mesh.material;
    supportMesh.updateMatrix();
    supportMesh.matrixAutoUpdate = false;
    const baselineLocalMatrix = supportMesh.matrix.clone();

    mesh.geometry = bridgeGeometry;
    mesh.parent.add(supportMesh);

    supportBranches.push({
      mesh: supportMesh,
      baselineLocalMatrix,
    });

    originalIndexCount += source.length;
    supportIndexCount += supportIndices.length;
    bridgeIndexCount += bridgeIndices.length;
  }

  if (!supportBranches.length) {
    throw new Error("A1 exact stock lower support components were not found");
  }
  if (supportIndexCount + bridgeIndexCount !== originalIndexCount) {
    throw new Error("A1 exact support split did not preserve every source index");
  }

  return Object.freeze({
    branches: supportBranches,
    originalIndexCount,
    supportIndexCount,
    bridgeIndexCount,
    authority:
      "XP11-jw_tunnel_2_5b-connected-source-components-lower-support-v1",
  });
}

export function installA1ExactAutoGateController({
  THREE,
  root,
  footprint,
  wallEvidence,
  gateMap,
}) {
  if (!THREE || !root?.isObject3D) throw new Error("A1 exact stock jetway root is required");
  if (gateMap?.gate !== "A1" || gateMap?.facadeWedObjectId !== 104804) {
    throw new Error("A1 exact AutoGate controller received the wrong WED facade");
  }
  if (!Array.isArray(footprint) || footprint.length !== 7) {
    throw new Error(`A1 exact AutoGate controller expected seven WED nodes, received ${footprint?.length ?? 0}`);
  }
  if (wallEvidence?.map((entry) => entry.wallName).join("|")
    !== "Rotunda_extension|Rotunda_extension|Rotunda_extension|Rotunda_extension|Tunnel_11-15.5m|Cabin") {
    throw new Error("A1 exact AutoGate controller wall sequence changed");
  }

  const defaultProfile = getRampReadyAircraftDoorProfile("CRJ700");
  let doorTargets = getAutoGateDoorTargets(defaultProfile);
  const attachedLatMeters = doorTargets.latMeters;
  if (!(attachedLatMeters > 0 && attachedLatMeters < AUTOGATE_26M.latRangeMeters[1])) {
    throw new Error(`A1 CRJ AutoGate lat target is outside the supplied 26 m curve: ${attachedLatMeters}`);
  }

  const fixedWalls = [1, 2, 3, 4].map((number) =>
    requireObject(root, `Wall_${number}_Rotunda_extension`));
  const tunnelWall = requireObject(root, "Wall_5_Tunnel_11-15.5m");
  const cabinWall = requireObject(root, "Wall_6_Cabin");
  const terminalTunnelSegment = requireObject(tunnelWall, "Segment_10_0");
  const aircraftTunnelSegment = requireObject(tunnelWall, "Segment_11_1");
  const cabinHalfB = requireObject(aircraftTunnelSegment, "Attached_jw_cabin_1b.obj");
  const cabinHalfBAttachmentPivot = cabinHalfB.parent;
  const terminalTunnelVisual = requireObject(
    terminalTunnelSegment,
    "Attached_jw_tunnel_2_5a.obj",
  );
  const terminalHingeAttachmentPivot = terminalTunnelVisual.parent;
  const aircraftTunnelVisual = requireObject(
    aircraftTunnelSegment,
    "Attached_jw_tunnel_2_5b.obj",
  );
  const aircraftEntranceAttachmentPivot = aircraftTunnelVisual.parent;
  const lowerSupport = splitExactLowerSupportComponents(
    THREE,
    aircraftTunnelVisual,
  );
  const cabinHalfA = requireObject(cabinWall, "Attached_jw_cabin_1a.obj");
  root.updateMatrixWorld(true);
  const measureLowerSupportBottom = () => {
    let minimum = Number.POSITIVE_INFINITY;
    for (const branch of lowerSupport.branches) {
      const box = new THREE.Box3().setFromObject(branch.mesh);
      minimum = Math.min(minimum, box.min.y);
    }
    return minimum;
  };
  const sourceLowerSupportBottomMeters = measureLowerSupportBottom();

  const pivot = footprint[4];
  const attachedCabinJoint = footprint[5];
  const attachedTunnelVector = {
    x: attachedCabinJoint.x - pivot.x,
    z: attachedCabinJoint.y - pivot.y,
  };
  const attachedTunnelLength = Math.hypot(attachedTunnelVector.x, attachedTunnelVector.z);
  if (!(attachedTunnelLength > attachedLatMeters + 1)) {
    throw new Error(`A1 exact tunnel length ${attachedTunnelLength} cannot retract ${attachedLatMeters} m safely`);
  }
  const tunnelUnit = {
    x: attachedTunnelVector.x / attachedTunnelLength,
    z: attachedTunnelVector.z / attachedTunnelLength,
  };

  const fixedWallOriginals = fixedWalls.map((wall) => Object.freeze({
    name: wall.name,
    x: wall.position.x,
    y: wall.position.y,
    z: wall.position.z,
    rotationY: wall.rotation.y,
  }));

  const originals = Object.freeze({
    tunnelPosition: tunnelWall.position.clone(),
    tunnelPositionY: tunnelWall.position.y,
    tunnelRotationX: tunnelWall.rotation.x,
    tunnelRotationY: tunnelWall.rotation.y,
    tunnelRotationZ: tunnelWall.rotation.z,
    cabinPosition: cabinWall.position.clone(),
    cabinRotationY: cabinWall.rotation.y,
    aircraftTunnelSegmentZ: aircraftTunnelSegment.position.z,
    cabinHalfBRotationY: cabinHalfB.rotation.y,
    cabinHalfARotationY: cabinHalfA.rotation.y,
  });
  root.updateMatrixWorld(true);
  const sourceTerminalHingeWorld =
    terminalHingeAttachmentPivot.getWorldPosition(new THREE.Vector3()).clone();
  const sourceAircraftEntranceWorld =
    aircraftEntranceAttachmentPivot.getWorldPosition(new THREE.Vector3()).clone();

  // The exact WED stock facade is the authored parked/rest pose. AutoGate's
  // datarefs are zero in that pose and rise toward the aircraft during ENGAGE.
  // Therefore all dynamic yaw/telescope deltas are measured from lat=0, not
  // from the attached lat target.
  const restBridgeYaw = linearCurve(AUTOGATE_26M.bridgeYawDegrees, 0);
  const restCabinRelativeYaw = linearCurve(
    AUTOGATE_26M.cabinRelativeYawDegrees,
    0,
  );
  const innerTunnelTravelPerLatMeter =
    (Math.abs(AUTOGATE_26M.innerTunnelTranslationYMeters[1])
      - Math.abs(AUTOGATE_26M.innerTunnelTranslationYMeters[0]))
    / AUTOGATE_26M.latRangeMeters[1];
  const history = ["attached-to-aircraft-door"];
  let deployment = 1;
  let connectedLatMeters = attachedLatMeters;
  let connectedVertMeters = doorTargets.vertMeters;
  let dockingCorrectionMeters = 0;
  let dockingVerticalCorrectionMeters = 0;
  let doorContactGapMeters = Number.NaN;
  let doorContactHitObject = "unregistered";
  let doorContactReady = false;

  function setDeployment(value) {
    deployment = clamp(Number(value) || 0, 0, 1);
    // The WED-authored pose is the exact geometry baseline. Once the rendered
    // aircraft door is available, connectedLatMeters includes only the small
    // AutoGate-consistent correction required to put the visible cabin/hood
    // against that real door. Deployment 0 still returns to the source rest
    // dataref value rather than bypassing the visible departure motion.
    const currentLatMeters = connectedLatMeters * deployment;
    const currentVertMeters = connectedVertMeters * deployment;
    const retractMeters = connectedLatMeters - currentLatMeters;

    // WED is lat=0/rest. ENGAGE increases lat toward the ACF door target.
    // Port the supplied AutoGate-26m yaw and inner-tunnel translation from that
    // true rest baseline; DISENGAGE simply reverses these same source curves.
    const bridgeYaw = linearCurve(AUTOGATE_26M.bridgeYawDegrees, currentLatMeters);
    const bridgeYawDelta = radians(bridgeYaw - restBridgeYaw);
    const cabinRelativeYaw = linearCurve(
      AUTOGATE_26M.cabinRelativeYawDegrees,
      currentLatMeters,
    );
    const cabinCounterYawDelta = radians(cabinRelativeYaw - restCabinRelativeYaw);
    const innerTunnelExtensionMeters =
      currentLatMeters * innerTunnelTravelPerLatMeter;

    // Exact XP11 spelling [10,11]: Segment 10 owns jw_tunnel_2_5a at
    // the terminal-side start of the moving span; Segment 11 owns
    // jw_tunnel_2_5b plus cabin-half-B at the aircraft-side end. Telescope
    // Segment 11 using the MisterX lat curve, but never translate the whole
    // Tunnel wall vertically: its origin is the real rear hinge at WED node
    // 104809 and must remain physically attached to the fixed support.
    aircraftTunnelSegment.position.z = originals.aircraftTunnelSegmentZ
      - innerTunnelExtensionMeters / tunnelWall.scale.z;

    for (const branch of lowerSupport.branches) {
      branch.mesh.matrix.copy(branch.baselineLocalMatrix);
      branch.mesh.matrixWorldNeedsUpdate = true;
    }

    // Establish the current telescope/yaw pose with the exact source
    // transform and no additional pitch. Segment 10's stock attachment pivot
    // is the real elevated hinge (ATTACH_GRADED y=4.0), not the WED ground
    // origin. Segment 11's jw_tunnel_2_5b attachment is the aircraft-side
    // entrance reference at the same nominal 4.0 m height.
    tunnelWall.position.copy(originals.tunnelPosition);
    // Compose yaw first, then pitch about the bridge's own cross-axis.
    // Three.js's default XYZ Euler order makes local-X pitch lose vertical
    // authority as bridge yaw increases, which was why a ~7.5° physical tilt
    // produced only ~0.58 m of entrance movement. YXZ matches the jetway's
    // real yaw-then-pitch mechanism.
    tunnelWall.rotation.set(
      originals.tunnelRotationX,
      originals.tunnelRotationY + bridgeYawDelta,
      originals.tunnelRotationZ,
      "YXZ",
    );
    root.updateMatrixWorld(true);

    const baselineEntranceWorld =
      aircraftEntranceAttachmentPivot.getWorldPosition(new THREE.Vector3());
    const desiredSupportWorldMatrices = lowerSupport.branches.map(
      (branch) => branch.mesh.matrixWorld.clone(),
    );

    // Solve against the actual compiled Three.js hierarchy instead of an
    // idealized template-space vector. The facade compiler includes WED edge
    // stretch plus an inverse-stretch attachment parent, so evaluating the
    // real attachment pivots is the authoritative way to preserve the hinge
    // and hit AutoGate's metre-space vertical target.
    const targetEntranceWorldY = baselineEntranceWorld.y + currentVertMeters;
    const sourceHingeInParent =
      tunnelWall.parent.worldToLocal(sourceTerminalHingeWorld.clone());

    const applyPitchAtFixedHinge = (pitchRadians) => {
      tunnelWall.position.copy(originals.tunnelPosition);
      tunnelWall.rotation.set(
        pitchRadians,
        originals.tunnelRotationY + bridgeYawDelta,
        originals.tunnelRotationZ,
        "YXZ",
      );
      root.updateMatrixWorld(true);

      const pitchedHingeWorld =
        terminalHingeAttachmentPivot.getWorldPosition(new THREE.Vector3());
      const pitchedHingeInParent =
        tunnelWall.parent.worldToLocal(pitchedHingeWorld.clone());
      tunnelWall.position.add(
        sourceHingeInParent.clone().sub(pitchedHingeInParent),
      );
      root.updateMatrixWorld(true);

      return aircraftEntranceAttachmentPivot
        .getWorldPosition(new THREE.Vector3()).y;
    };

    const maxPitchDeltaRadians = radians(30);
    let lowPitch = originals.tunnelRotationX - maxPitchDeltaRadians;
    let highPitch = originals.tunnelRotationX + maxPitchDeltaRadians;
    let lowError = applyPitchAtFixedHinge(lowPitch) - targetEntranceWorldY;
    let highError = applyPitchAtFixedHinge(highPitch) - targetEntranceWorldY;
    if (lowError * highError > 0) {
      throw new Error(
        `A1 fixed elevated hinge cannot reach AutoGate vertical target ${currentVertMeters.toFixed(4)} m`,
      );
    }

    // Twelve bisection steps over a 60-degree bracket resolve pitch to
    // roughly 0.015 degrees, comfortably inside the 2 cm live vertical-error
    // gate while avoiding dozens of full hierarchy matrix updates every frame.
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const midPitch = (lowPitch + highPitch) / 2;
      const midError =
        applyPitchAtFixedHinge(midPitch) - targetEntranceWorldY;
      if (Math.abs(midError) <= 0.001) {
        lowPitch = midPitch;
        highPitch = midPitch;
        break;
      }
      if (lowError * midError <= 0) {
        highPitch = midPitch;
        highError = midError;
      } else {
        lowPitch = midPitch;
        lowError = midError;
      }
    }

    const solvedBridgePitch = (lowPitch + highPitch) / 2;
    const bridgePitchDelta = solvedBridgePitch - originals.tunnelRotationX;
    applyPitchAtFixedHinge(solvedBridgePitch);

    lowerSupport.branches.forEach((branch, index) => {
      const parentInverse = branch.mesh.parent.matrixWorld.clone().invert();
      branch.mesh.matrix.copy(
        parentInverse.multiply(desiredSupportWorldMatrices[index]),
      );
      branch.mesh.matrixWorldNeedsUpdate = true;
    });
    root.updateMatrixWorld(true);

    // Segment 11 owns the exact stock cabin-half-B attachment pivot. After
    // telescope/yaw/pitch, use that transformed source joint directly instead
    // of estimating the Cabin-wall origin with trigonometry. This keeps the
    // two stock cabin halves physically closed for every AutoGate state while
    // preserving the WED terminal pivot and authored source objects.
    root.updateMatrixWorld(true);
    const movingCabinJointWorld =
      cabinHalfBAttachmentPivot.getWorldPosition(new THREE.Vector3());
    const movingCabinJointLocal = root.worldToLocal(movingCabinJointWorld.clone());
    const movingAircraftEntranceWorld =
      aircraftEntranceAttachmentPivot.getWorldPosition(new THREE.Vector3());
    const entranceVerticalDelta =
      movingAircraftEntranceWorld.y - sourceAircraftEntranceWorld.y;
    cabinWall.position.copy(movingCabinJointLocal);
    cabinWall.rotation.y =
      originals.cabinRotationY + bridgeYawDelta + cabinCounterYawDelta;

    // jw_cabin_1b is attached to the moving tunnel endpoint while cabin_1a is
    // attached to the Cabin wall. Apply the same AutoGate cabin counter-yaw so
    // both exact source halves remain aligned.
    cabinHalfB.rotation.y = originals.cabinHalfBRotationY + cabinCounterYawDelta;

    // The two stock cabin source objects meet at the same authored joint:
    // Segment 11 places jw_cabin_1b at its far endpoint and Cabin Segment 20
    // begins jw_cabin_1a at that exact WED node. Verify that articulation keeps
    // the joint closed and preserves the source relative yaw.
    root.updateMatrixWorld(true);
    const cabinHalfBJointWorld = cabinHalfBAttachmentPivot.getWorldPosition(new THREE.Vector3());
    const cabinWallJointWorld = cabinWall.getWorldPosition(new THREE.Vector3());
    const cabinJointGapMeters = cabinHalfBJointWorld.distanceTo(cabinWallJointWorld);
    const cabinAWorldYawDelta = cabinWall.rotation.y - originals.cabinRotationY;
    const cabinBWorldYawDelta =
      (tunnelWall.rotation.y - originals.tunnelRotationY)
      + (cabinHalfB.rotation.y - originals.cabinHalfBRotationY);
    const cabinRelativeYawDriftRadians = cabinBWorldYawDelta - cabinAWorldYawDelta;

    const state = deployment >= 0.995
      ? "attached-to-aircraft-door"
      : deployment <= 0.005
        ? "parked-clear-of-aircraft"
        : "autogate-disengaging";
    if (history.at(-1) !== state) history.push(state);

    root.userData.a1AutoGateDeployment = deployment;
    root.userData.a1AutoGateLatMeters = currentLatMeters;
    root.userData.a1AutoGateVertMeters = currentVertMeters;
    root.userData.a1AutoGateBridgePitchDegrees = THREE.MathUtils.radToDeg(bridgePitchDelta);
    root.userData.a1AutoGateCabinVerticalDeltaMeters = entranceVerticalDelta;
    root.userData.a1AutoGateRetractedMeters = retractMeters;
    root.userData.a1AutoGateInnerTunnelExtensionMeters = innerTunnelExtensionMeters;
    root.userData.a1AutoGateBridgeYawDeltaDegrees = bridgeYaw - restBridgeYaw;
    root.userData.a1AutoGateCabinCounterYawDeltaDegrees = cabinRelativeYaw - restCabinRelativeYaw;
    root.userData.a1AutoGateCabinJointGapMeters = cabinJointGapMeters;
    root.userData.a1AutoGateCabinRelativeYawDriftRadians = cabinRelativeYawDriftRadians;
    const terminalHingeWorld =
      terminalHingeAttachmentPivot.getWorldPosition(new THREE.Vector3());
    const terminalPivotGapMeters =
      terminalHingeWorld.distanceTo(sourceTerminalHingeWorld);
    root.userData.a1AutoGateTerminalPivotGapMeters = terminalPivotGapMeters;
    root.userData.a1AutoGateCabinVerticalErrorMeters =
      entranceVerticalDelta - currentVertMeters;
    const lowerSupportBottomMeters = measureLowerSupportBottom();
    root.userData.a1AutoGateSupportBottomMeters = lowerSupportBottomMeters;
    root.userData.a1AutoGateSupportBottomDeltaMeters =
      lowerSupportBottomMeters - sourceLowerSupportBottomMeters;
    root.userData.a1AutoGateSupportOriginalIndexCount =
      lowerSupport.originalIndexCount;
    root.userData.a1AutoGateSupportSplitIndexCount =
      lowerSupport.supportIndexCount;
    root.userData.a1AutoGateBridgeSplitIndexCount =
      lowerSupport.bridgeIndexCount;
    root.userData.a1AutoGateSupportTrianglePartitionExact =
      lowerSupport.supportIndexCount + lowerSupport.bridgeIndexCount
        === lowerSupport.originalIndexCount;
    root.userData.a1AutoGateState = state;

    let fixedWallMotionMaxMeters = 0;
    let fixedWallRotationMaxRadians = 0;
    fixedWalls.forEach((wall, index) => {
      const baseline = fixedWallOriginals[index];
      fixedWallMotionMaxMeters = Math.max(
        fixedWallMotionMaxMeters,
        Math.hypot(
          wall.position.x - baseline.x,
          wall.position.y - baseline.y,
          wall.position.z - baseline.z,
        ),
      );
      fixedWallRotationMaxRadians = Math.max(
        fixedWallRotationMaxRadians,
        Math.abs(wall.rotation.y - baseline.rotationY),
      );
    });
    root.userData.a1AutoGateFixedWallMotionMaxMeters = fixedWallMotionMaxMeters;
    root.userData.a1AutoGateFixedWallRotationMaxRadians = fixedWallRotationMaxRadians;
  }

  function measureDoorContactGap(targetWorld, outwardWorldDirection) {
    if (!targetWorld?.isVector3 || !outwardWorldDirection?.isVector3) {
      return {
        distance: Number.POSITIVE_INFINITY,
        signedDistance: Number.NaN,
        objectName: "invalid-target",
      };
    }
    root.updateMatrixWorld(true);
    const direction = outwardWorldDirection.clone().normalize();
    const candidates = [];
    for (const sign of [1, -1]) {
      const raycaster = new THREE.Raycaster(
        targetWorld,
        direction.clone().multiplyScalar(sign),
        0,
        4.5,
      );
      const hits = raycaster.intersectObjects([cabinHalfA, cabinHalfB], true)
        .filter((hit) => Number.isFinite(hit.distance) && hit.distance >= 0);
      if (hits.length) candidates.push({ ...hits[0], sign });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    if (!candidates.length) {
      return {
        distance: Number.POSITIVE_INFINITY,
        signedDistance: Number.NaN,
        objectName: "no-visible-cabin-hit",
      };
    }
    return {
      distance: candidates[0].distance,
      signedDistance: candidates[0].distance * candidates[0].sign,
      objectName: candidates[0].object?.name
        || candidates[0].object?.parent?.name
        || "cabin-mesh",
    };
  }

  function evaluateConnectedPose(
    candidateLatMeters,
    candidateVertMeters,
    targetWorld,
    outwardWorldDirection,
  ) {
    connectedLatMeters = clamp(candidateLatMeters, 0.05, AUTOGATE_26M.latRangeMeters[1]);
    connectedVertMeters = clamp(
      candidateVertMeters,
      AUTOGATE_26M.vertRangeMeters[0],
      AUTOGATE_26M.vertRangeMeters[1],
    );
    setDeployment(1);
    const hit = measureDoorContactGap(targetWorld, outwardWorldDirection);
    return {
      connectedLatMeters,
      connectedVertMeters,
      correctionMeters: connectedLatMeters - attachedLatMeters,
      verticalCorrectionMeters: connectedVertMeters,
      gapMeters: hit.distance,
      signedGapMeters: hit.signedDistance,
      objectName: hit.objectName,
    };
  }

  function registerAircraftDoorContact({
    targetWorld,
    outwardWorldDirection,
    aircraftType = doorTargets.aircraftType,
  } = {}) {
    if (!targetWorld?.isVector3 || !outwardWorldDirection?.isVector3) {
      throw new Error("A1 X-Plane ACF aircraft door contact requires exact world point and outward direction");
    }

    const profile = getRampReadyAircraftDoorProfile(aircraftType);
    if (!profile) throw new Error(`Unsupported A1 aircraft AutoGate profile: ${aircraftType}`);
    const exactTargets = getAutoGateDoorTargets(profile);
    if (Math.abs(exactTargets.latMeters - attachedLatMeters) > 0.001) {
      throw new Error(
        `A1 AutoGate lateral source changed from ${attachedLatMeters.toFixed(4)} to ${exactTargets.latMeters.toFixed(4)} m`,
      );
    }
    if (!Number.isFinite(exactTargets.vertMeters)) {
      throw new Error(`A1 ${profile.aircraftType} ACF has no finite AutoGate vertical target`);
    }

    doorTargets = exactTargets;
    let solved = evaluateConnectedPose(
      exactTargets.latMeters,
      exactTargets.vertMeters,
      targetWorld,
      outwardWorldDirection,
    );

    // The ACF gives AutoGate's exact aircraft-door dataref target. The XP11
    // stock cabin, however, has a visible lip/hood offset from the WED path
    // endpoint. Resolve only that source-geometry offset from the rendered
    // cabin itself. AutoGate defines +1 m lat as +1 m entrance travel toward
    // the aircraft, so the signed door-to-cabin ray gap is the correction.
    // Keep the solve tightly bounded around the ACF value; never move the WED
    // terminal anchor or aircraft stand to manufacture contact.
    // The fixed physical hinge changes the stock cabin's visible lip path
    // relative to the old whole-span translation approximation. Allow the
    // rendered source cabin-contact solve enough room to reach the real ACF
    // L1 door while still remaining tightly bounded inside AutoGate's 7.5 m
    // lateral range. This is contact correction only; the ACF lat target,
    // aircraft placement, WED hinge, and source geometry remain unchanged.
    const maxVisibleContactCorrectionMeters = 0.80;
    for (let iteration = 0; iteration < 4; iteration += 1) {
      if (Number.isFinite(solved.gapMeters) && solved.gapMeters <= 0.08) break;
      if (!Number.isFinite(solved.signedGapMeters)) break;

      const minimumLat = exactTargets.latMeters - maxVisibleContactCorrectionMeters;
      const maximumLat = exactTargets.latMeters + maxVisibleContactCorrectionMeters;
      const nextLatMeters = clamp(
        solved.connectedLatMeters + solved.signedGapMeters,
        minimumLat,
        maximumLat,
      );
      if (Math.abs(nextLatMeters - solved.connectedLatMeters) < 0.001) break;

      const next = evaluateConnectedPose(
        nextLatMeters,
        exactTargets.vertMeters,
        targetWorld,
        outwardWorldDirection,
      );
      if (Number.isFinite(solved.gapMeters)
        && Number.isFinite(next.gapMeters)
        && next.gapMeters > solved.gapMeters + 0.01) {
        break;
      }
      solved = next;
    }

    connectedLatMeters = solved.connectedLatMeters;
    connectedVertMeters = solved.connectedVertMeters;
    dockingCorrectionMeters = solved.correctionMeters;
    dockingVerticalCorrectionMeters = solved.verticalCorrectionMeters;
    setDeployment(1);

    const finalHit = measureDoorContactGap(targetWorld, outwardWorldDirection);
    doorContactGapMeters = finalHit.distance;
    doorContactHitObject = finalHit.objectName;
    doorContactReady =
      Number.isFinite(doorContactGapMeters) && doorContactGapMeters <= 0.08;

    root.userData.a1AutoGateAircraftType = profile.aircraftType;
    root.userData.a1AutoGateAircraftSourceAcf = profile.sourceAcf;
    root.userData.a1AutoGateConnectedLatMeters = connectedLatMeters;
    root.userData.a1AutoGateConnectedVertMeters = connectedVertMeters;
    root.userData.a1AutoGateDockingCorrectionMeters = dockingCorrectionMeters;
    root.userData.a1AutoGateDockingVerticalCorrectionMeters = dockingVerticalCorrectionMeters;
    root.userData.a1AutoGateDoorContactGapMeters = doorContactGapMeters;
    root.userData.a1AutoGateDoorContactSignedGapMeters = finalHit.signedDistance;
    root.userData.a1AutoGateDoorContactHitObject = doorContactHitObject;
    root.userData.a1AutoGateDoorContactReady = doorContactReady;
    root.userData.a1AutoGateVerticalResolved = doorContactReady;
    root.userData.a1AutoGateDoorContactAuthority =
      "RobertSV-XPlane11-ACF-dock-port-plus-Marginal-AutoGate-lat-vert-plus-visible-stock-cabin-contact-v2";

    return Object.freeze({
      aircraftType: profile.aircraftType,
      sourceAcf: profile.sourceAcf,
      connectedLatMeters,
      connectedVertMeters,
      correctionMeters: dockingCorrectionMeters,
      verticalCorrectionMeters: dockingVerticalCorrectionMeters,
      gapMeters: doorContactGapMeters,
      hitObject: doorContactHitObject,
      ready: doorContactReady,
    });
  }

  const controller = Object.freeze({
    setDeployment,
    registerAircraftDoorContact,
    getDeployment: () => deployment,
    getState: () => root.userData.a1AutoGateState,
    getStateHistory: () => [...history],
    getLatMeters: () => root.userData.a1AutoGateLatMeters,
    getVertMeters: () => root.userData.a1AutoGateVertMeters,
    getBridgePitchDegrees: () => root.userData.a1AutoGateBridgePitchDegrees,
    getCabinVerticalDeltaMeters: () => root.userData.a1AutoGateCabinVerticalDeltaMeters,
    getRetractedMeters: () => root.userData.a1AutoGateRetractedMeters,
    getBridgeYawDeltaDegrees: () => root.userData.a1AutoGateBridgeYawDeltaDegrees,
    getCabinCounterYawDeltaDegrees: () => root.userData.a1AutoGateCabinCounterYawDeltaDegrees,
    getCabinJointGapMeters: () => root.userData.a1AutoGateCabinJointGapMeters,
    getCabinRelativeYawDriftRadians: () => root.userData.a1AutoGateCabinRelativeYawDriftRadians,
    getTerminalPivotGapMeters: () => root.userData.a1AutoGateTerminalPivotGapMeters,
    getCabinVerticalErrorMeters: () => root.userData.a1AutoGateCabinVerticalErrorMeters,
    getSupportBottomMeters: () => root.userData.a1AutoGateSupportBottomMeters,
    getSupportBottomDeltaMeters: () => root.userData.a1AutoGateSupportBottomDeltaMeters,
    isSupportTrianglePartitionExact: () =>
      root.userData.a1AutoGateSupportTrianglePartitionExact === true,
    getFixedWallMotionMaxMeters: () => root.userData.a1AutoGateFixedWallMotionMaxMeters,
    getFixedWallRotationMaxRadians: () => root.userData.a1AutoGateFixedWallRotationMaxRadians,
    getAttachedLatMeters: () => attachedLatMeters,
    getConnectedLatMeters: () => connectedLatMeters,
    getConnectedVertMeters: () => connectedVertMeters,
    getDockingCorrectionMeters: () => dockingCorrectionMeters,
    getDockingVerticalCorrectionMeters: () => dockingVerticalCorrectionMeters,
    getDoorContactGapMeters: () => doorContactGapMeters,
    getDoorContactHitObject: () => doorContactHitObject,
    isDoorContactReady: () => doorContactReady,
    getMotionDurationMs: () => AUTOGATE_REFERENCE.motionDurationSeconds * 1000,
    getDoorTargets: () => Object.freeze({
      ...doorTargets,
      vertMeters: connectedVertMeters,
      verticalResolved: doorContactReady,
      authority: doorContactReady
        ? "autogate-visible-aircraft-door-lat-vert-solved-v2"
        : doorTargets.authority,
    }),
  });

  root.userData.a1AutoGateControllerAuthority =
    "exact-A1-fixed-terminal-hinge-plus-stock-support-telescope-v11";
  root.userData.a1AutoGateTerminalPivotAuthority =
    "WED-104809-Segment10-jw_tunnel_2_5a-ATTACH_GRADED-y4-fixed-rear-hinge";
  root.userData.a1AutoGateLowerSupportAuthority = lowerSupport.authority;
  root.userData.a1AutoGateSourceGeometryAuthority =
    "KPHX-1.75.1-WED-104804-plus-XP11-Jetway_1_solid.fac";
  root.userData.a1AutoGateMotionSource = AUTOGATE_26M.sourceAsset;
  root.userData.a1AutoGateHorizontalDataref = AUTOGATE_REFERENCE.horizontalDataref;
  root.userData.a1AutoGateVerticalDataref = AUTOGATE_REFERENCE.verticalDataref;
  root.userData.a1AutoGateAttachedLatMeters = attachedLatMeters;
  root.userData.a1AutoGateConnectedLatMeters = connectedLatMeters;
  root.userData.a1AutoGateConnectedVertMeters = connectedVertMeters;
  root.userData.a1AutoGateDockingCorrectionMeters = connectedLatMeters - attachedLatMeters;
  root.userData.a1AutoGateDockingVerticalCorrectionMeters = connectedVertMeters;
  root.userData.a1AutoGateDoorContactGapMeters = Number.NaN;
  root.userData.a1AutoGateDoorContactHitObject = "unregistered";
  root.userData.a1AutoGateDoorContactReady = false;
  root.userData.a1AutoGateVerticalResolved = false;
  root.userData.a1AutoGateFixedWalls = fixedWalls.map((wall) => wall.name).join("|");
  root.userData.a1AutoGateMovingWall = tunnelWall.name;
  root.userData.a1AutoGateCabinWall = cabinWall.name;
  root.userData.a1AutoGateCabinHalfA = cabinHalfA.name;
  root.userData.a1AutoGateCabinHalfB = cabinHalfB.name;
  root.userData.a1AutoGateCabinJointAuthority =
    "Segment-11-attached-cabin-pivot-world-to-Cabin-wall-origin";
  root.userData.a1AutoGatePivotWedNodeId = 104809;
  root.userData.a1AutoGateCabinJointWedNodeId = 104810;
  root.userData.a1AutoGateAttachedTunnelLengthMeters = attachedTunnelLength;
  root.userData.a1AutoGateRequiredPrePushSequence =
    "AutoGate DISENGAGE: reverse meter-space lat target to zero over 15 seconds; exact tunnel telescopes and cabin counter-rotates";
  setDeployment(1);

  return controller;
}
