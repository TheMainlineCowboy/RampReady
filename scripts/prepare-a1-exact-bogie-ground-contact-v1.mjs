import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const authority = "exact-authored-a1-connected-wheel-pair-ramp-contact-v4";
const retiredAuthorities = [
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
  "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3",
];
const fixedOffsetPattern = /  fleet\.position\.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;\n  fleet\.updateMatrixWorld\(true\);/;

const measuredOffsetBlock = `  // Keep the 57 static exact bridges on the shared authored fleet ground frame.
  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);

  // ${authority}
  // A1 uses the exact connected source wheel pair inside Tunnel_C_Jetway_0.
  // Never accept an arbitrary low point, Rotunda pedestal, or terminal-side
  // support as the aircraft-side bogie/wheel contact authority.
  const bogieMesh = a1Model.getObjectByName("Tunnel_C_Jetway_0");
  const rotundaMeshForBogie = a1Model.getObjectByName("Rotunda_Jetway_0");
  const cabMeshForBogie = a1Model.getObjectByName("Cab_Jetway_0");
  if (!bogieMesh?.isMesh || !rotundaMeshForBogie?.isMesh || !cabMeshForBogie?.isMesh) {
    throw new Error("A1 exact supplied jetway is missing Tunnel_C/Rotunda/Cab source geometry for wheel-pair grounding");
  }

  const position = bogieMesh.geometry?.getAttribute?.("position");
  const geometryIndex = bogieMesh.geometry?.getIndex?.();
  if (!position || position.count < 1000) throw new Error("A1 exact Tunnel_C source positions are missing");
  const indexCount = geometryIndex?.count ?? position.count;
  if (indexCount % 3 !== 0) throw new Error(\`A1 exact Tunnel_C source index count is not triangular: \${indexCount}\`);

  const topologyParent = Array.from({ length: position.count }, (_, index) => index);
  const topologyRank = new Uint8Array(position.count);
  const topologyFind = (input) => {
    let root = input;
    while (topologyParent[root] !== root) root = topologyParent[root];
    let cursor = input;
    while (topologyParent[cursor] !== cursor) {
      const next = topologyParent[cursor];
      topologyParent[cursor] = root;
      cursor = next;
    }
    return root;
  };
  const topologyUnion = (left, right) => {
    let a = topologyFind(left);
    let b = topologyFind(right);
    if (a === b) return;
    if (topologyRank[a] < topologyRank[b]) [a, b] = [b, a];
    topologyParent[b] = a;
    if (topologyRank[a] === topologyRank[b]) topologyRank[a] += 1;
  };
  const sourcePoint = new THREE.Vector3();
  const weldedPositionOwner = new Map();
  const weldEpsilon = 1e-5;
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    sourcePoint.fromBufferAttribute(position, vertexIndex);
    const key = [sourcePoint.x, sourcePoint.y, sourcePoint.z]
      .map((value) => Math.round(value / weldEpsilon))
      .join(":");
    const owner = weldedPositionOwner.get(key);
    if (owner === undefined) weldedPositionOwner.set(key, vertexIndex);
    else topologyUnion(vertexIndex, owner);
  }
  const indexAt = (offset) => geometryIndex ? geometryIndex.getX(offset) : offset;
  for (let offset = 0; offset < indexCount; offset += 3) {
    const a = indexAt(offset);
    const b = indexAt(offset + 1);
    const c = indexAt(offset + 2);
    topologyUnion(a, b);
    topologyUnion(b, c);
    topologyUnion(c, a);
  }

  const componentVertices = new Map();
  const componentTriangleCount = new Map();
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    const root = topologyFind(vertexIndex);
    if (!componentVertices.has(root)) componentVertices.set(root, []);
    componentVertices.get(root).push(vertexIndex);
  }
  for (let offset = 0; offset < indexCount; offset += 3) {
    const root = topologyFind(indexAt(offset));
    componentTriangleCount.set(root, (componentTriangleCount.get(root) || 0) + 1);
  }

  const fleetParent = fleet.parent;
  if (!fleetParent?.matrixWorld) throw new Error("A1 exact jetway fleet has no matrix-bearing parent");
  const point = new THREE.Vector3();
  const boxCenter = new THREE.Vector3();
  const boxSize = new THREE.Vector3();
  const fleetParentWorldInverse = new THREE.Matrix4();
  const updateBogieMatrices = () => {
    group.updateWorldMatrix(true, true);
    fleet.updateWorldMatrix(true, true);
    a1Anchor.updateWorldMatrix(true, true);
    a1Model.updateWorldMatrix(true, true);
    bogieMesh.updateWorldMatrix(true, false);
    rotundaMeshForBogie.updateWorldMatrix(true, false);
    cabMeshForBogie.updateWorldMatrix(true, false);
    fleetParentWorldInverse.copy(fleetParent.matrixWorld).invert();
  };
  const objectCenterInFleetParent = (object) => {
    const worldBox = new THREE.Box3().setFromObject(object);
    if (worldBox.isEmpty()) throw new Error(\`A1 exact source object has empty bounds: \${object.name}\`);
    return worldBox.getCenter(new THREE.Vector3()).applyMatrix4(fleetParentWorldInverse);
  };
  const readPoint = (vertexIndex, coordinateSpace) => {
    point.fromBufferAttribute(position, vertexIndex).applyMatrix4(bogieMesh.matrixWorld);
    if (coordinateSpace === "fleet-parent") point.applyMatrix4(fleetParentWorldInverse);
    return point;
  };

  const resolveExactWheelPair = (coordinateSpace = "fleet-parent") => {
    if (coordinateSpace !== "fleet-parent" && coordinateSpace !== "world") {
      throw new Error(\`Unsupported A1 wheel-pair coordinate space: \${coordinateSpace}\`);
    }
    updateBogieMatrices();
    const rotundaCenter = objectCenterInFleetParent(rotundaMeshForBogie);
    const cabCenter = objectCenterInFleetParent(cabMeshForBogie);
    const axis = cabCenter.clone().sub(rotundaCenter);
    axis.y = 0;
    const axisLengthSq = axis.lengthSq();
    if (axisLengthSq < 100) throw new Error("A1 final Rotunda-to-Cab axis is too short for bogie validation");

    const candidates = [];
    for (const [root, vertices] of componentVertices) {
      const triangleCount = componentTriangleCount.get(root) || 0;
      if (triangleCount < 900 || triangleCount > 1300) continue;
      const box = new THREE.Box3();
      for (const vertexIndex of vertices) box.expandByPoint(readPoint(vertexIndex, "fleet-parent"));
      if (box.isEmpty()) continue;
      const center = box.getCenter(boxCenter.clone());
      const size = box.getSize(boxSize.clone());
      const offset = center.clone().sub(rotundaCenter);
      offset.y = 0;
      const axisT = offset.dot(axis) / axisLengthSq;
      const distanceToRotunda = Math.hypot(center.x - rotundaCenter.x, center.z - rotundaCenter.z);
      const distanceToCab = Math.hypot(center.x - cabCenter.x, center.z - cabCenter.z);
      const wheelSized = size.x >= 0.65 && size.x <= 1.45
        && size.y >= 0.65 && size.y <= 1.45
        && size.z >= 0.65 && size.z <= 1.55;
      const aircraftSide = axisT >= 0.58 && axisT <= 0.78 && distanceToCab < distanceToRotunda;
      const belowPassengerTube = center.y < Math.min(rotundaCenter.y, cabCenter.y) - 2.0;
      if (!wheelSized || !aircraftSide || !belowPassengerTube) continue;
      candidates.push({ root, vertices, triangleCount, center: center.clone(), size: size.clone(), axisT, distanceToRotunda, distanceToCab });
    }
    if (candidates.length !== 2) {
      throw new Error(\`A1 exact Tunnel_C must expose exactly two authored aircraft-side wheel shells; found \${candidates.length}\`);
    }
    candidates.sort((left, right) => left.center.x - right.center.x || left.center.z - right.center.z);
    const wheelSeparation = Math.hypot(
      candidates[0].center.x - candidates[1].center.x,
      candidates[0].center.z - candidates[1].center.z,
    );
    const axisTDelta = Math.abs(candidates[0].axisT - candidates[1].axisT);
    if (wheelSeparation < 1.4 || wheelSeparation > 3.0 || axisTDelta > 0.08) {
      throw new Error(\`A1 authored wheel pair is not a credible bogie axle: separation=\${wheelSeparation}, axisDelta=\${axisTDelta}\`);
    }
    return Object.freeze({ candidates, rotundaCenter, cabCenter, axis, axisLengthSq, wheelSeparation });
  };

  const measureAuthoredA1BogieContact = (coordinateSpace = "fleet-parent") => {
    const wheelPair = resolveExactWheelPair(coordinateSpace);
    let minimumY = Number.POSITIVE_INFINITY;
    let authoredVertexCount = 0;
    for (const wheel of wheelPair.candidates) {
      for (const vertexIndex of wheel.vertices) {
        readPoint(vertexIndex, coordinateSpace);
        minimumY = Math.min(minimumY, point.y);
        authoredVertexCount += 1;
      }
    }
    if (!Number.isFinite(minimumY) || authoredVertexCount < 500) {
      throw new Error(\`A1 exact authored wheel-pair scan is invalid: minimum=\${minimumY}, vertices=\${authoredVertexCount}\`);
    }

    const contactBandMeters = 0.12;
    const cellSizeMeters = 0.22;
    const contactBounds = new THREE.Box3();
    const occupiedCells = new Set();
    let contactPointCount = 0;
    for (const wheel of wheelPair.candidates) {
      for (const vertexIndex of wheel.vertices) {
        readPoint(vertexIndex, coordinateSpace);
        if (point.y > minimumY + contactBandMeters) continue;
        contactBounds.expandByPoint(point);
        occupiedCells.add([Math.floor(point.x / cellSizeMeters), Math.floor(point.z / cellSizeMeters)].join(","));
        contactPointCount += 1;
      }
    }

    const remaining = new Set(occupiedCells);
    let contactClusterCount = 0;
    while (remaining.size) {
      contactClusterCount += 1;
      const first = remaining.values().next().value;
      remaining.delete(first);
      const stack = [first];
      while (stack.length) {
        const [cellX, cellZ] = stack.pop().split(",").map(Number);
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dz = -1; dz <= 1; dz += 1) {
            const neighbor = [cellX + dx, cellZ + dz].join(",");
            if (!remaining.delete(neighbor)) continue;
            stack.push(neighbor);
          }
        }
      }
    }

    const contactSpan = contactBounds.getSize(new THREE.Vector3());
    const contactCenter = contactBounds.getCenter(new THREE.Vector3());
    const horizontalContactSpanMeters = Math.hypot(contactSpan.x, contactSpan.z);
    const rotundaDistance = Math.hypot(
      contactCenter.x - wheelPair.rotundaCenter.x,
      contactCenter.z - wheelPair.rotundaCenter.z,
    );
    const cabDistance = Math.hypot(
      contactCenter.x - wheelPair.cabCenter.x,
      contactCenter.z - wheelPair.cabCenter.z,
    );
    const centerOffset = contactCenter.clone().sub(wheelPair.rotundaCenter);
    centerOffset.y = 0;
    const contactAxisT = centerOffset.dot(wheelPair.axis) / wheelPair.axisLengthSq;
    if (contactBounds.isEmpty()
      || contactPointCount < 8
      || contactClusterCount < 2
      || horizontalContactSpanMeters < 1.4
      || contactAxisT < 0.58
      || contactAxisT > 0.78
      || !(cabDistance < rotundaDistance)
      || ![contactCenter.x, contactCenter.y, contactCenter.z].every(Number.isFinite)) {
      throw new Error(\`A1 exact authored wheel pair does not expose an aircraft-side ramp footprint: points=\${contactPointCount}, clusters=\${contactClusterCount}, span=\${horizontalContactSpanMeters}, axisT=\${contactAxisT}, rotunda=\${rotundaDistance}, cab=\${cabDistance}\`);
    }
    return Object.freeze({
      coordinateSpace,
      minimumY,
      authoredVertexCount,
      contactPointCount,
      contactClusterCount,
      spanX: contactSpan.x,
      spanZ: contactSpan.z,
      horizontalContactSpanMeters,
      centerX: contactCenter.x,
      centerY: contactCenter.y,
      centerZ: contactCenter.z,
      contactAxisT,
      rotundaDistance,
      cabDistance,
      wheelSeparationMeters: wheelPair.wheelSeparation,
      wheelTriangleCount: wheelPair.candidates.reduce((sum, wheel) => sum + wheel.triangleCount, 0),
    });
  };

  const authoredA1BogieBefore = measureAuthoredA1BogieContact("fleet-parent");
  const measuredA1BogieGroundOffsetMeters = -authoredA1BogieBefore.minimumY;
  if (!Number.isFinite(measuredA1BogieGroundOffsetMeters) || Math.abs(measuredA1BogieGroundOffsetMeters) > 8) {
    throw new Error(\`A1 exact authored wheel-pair ground offset is invalid: \${measuredA1BogieGroundOffsetMeters}\`);
  }
  a1Anchor.position.y += measuredA1BogieGroundOffsetMeters;
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  a1Anchor.updateWorldMatrix(true, true);
  a1Model.updateWorldMatrix(true, true);

  const authoredA1BogieAfter = measureAuthoredA1BogieContact("fleet-parent");
  const measuredBogieGroundClearanceMeters = authoredA1BogieAfter.minimumY;
  if (Math.abs(measuredBogieGroundClearanceMeters) > 0.015) {
    throw new Error(\`A1 exact authored wheel pair missed the ramp plane by \${measuredBogieGroundClearanceMeters} m\`);
  }
  let authoredA1BogieWorldAfter = measureAuthoredA1BogieContact("world");`;

if (source.includes(authority)) {
  // Idempotent second preparation: validate the generated v4 source and leave it unchanged.
} else if (fixedOffsetPattern.test(source)) {
  source = source.replace(fixedOffsetPattern, measuredOffsetBlock);
} else {
  throw new Error(`${installationPath}: could not install exact authored A1 wheel-pair grounding from the clean source anchor`);
}

for (const retired of retiredAuthorities) source = source.replaceAll(retired, authority);

if (!source.includes("const finalBogieWorldClearanceMeters = authoredA1BogieWorldAfter.minimumY")) {
  const finalAnchor = "  const doubleSidedMaterialCount = forceExactMaterialsDoubleSided(THREE, fleet);";
  if (!source.includes(finalAnchor)) throw new Error(`${installationPath}: final wheel-pair world check anchor is missing`);
  const finalCheck = `  // Final rendered authored wheel-pair ramp truth.\n  group.updateWorldMatrix(true, true);\n  fleet.updateWorldMatrix(true, true);\n  a1Anchor.updateWorldMatrix(true, true);\n  a1Model.updateWorldMatrix(true, true);\n  authoredA1BogieWorldAfter = measureAuthoredA1BogieContact("world");\n  const finalBogieWorldClearanceMeters = authoredA1BogieWorldAfter.minimumY;\n  if (Math.abs(finalBogieWorldClearanceMeters) > 0.015) {\n    throw new Error(\`A1 FINAL exact authored wheel pair is not on the ramp: \${finalBogieWorldClearanceMeters} m\`);\n  }\n`;
  source = source.replace(finalAnchor, `${finalCheck}${finalAnchor}`);
}

if (!source.includes("a1BogieGroundOffsetMeters: measuredA1BogieGroundOffsetMeters")) {
  const reportAnchor = "    bogieTireContactCorrectionMeters: BOGIE_TIRE_CONTACT_CORRECTION_METERS,";
  if (!source.includes(reportAnchor)) throw new Error(`${installationPath}: installation report anchor is missing`);
  source = source.replace(reportAnchor, `${reportAnchor}\n    a1BogieGroundOffsetMeters: measuredA1BogieGroundOffsetMeters,\n    bogieGroundClearanceMeters: finalBogieWorldClearanceMeters,\n    bogieGroundContactAuthority: "${authority}",\n    bogieGroundContactPointCount: authoredA1BogieWorldAfter.contactPointCount,\n    bogieGroundContactClusterCount: authoredA1BogieWorldAfter.contactClusterCount,\n    bogieGroundContactSpanX: authoredA1BogieWorldAfter.spanX,\n    bogieGroundContactSpanZ: authoredA1BogieWorldAfter.spanZ,\n    bogieGroundHorizontalContactSpanMeters: authoredA1BogieWorldAfter.horizontalContactSpanMeters,\n    bogieGroundContactCenterX: authoredA1BogieWorldAfter.centerX,\n    bogieGroundContactCenterY: authoredA1BogieWorldAfter.centerY,\n    bogieGroundContactCenterZ: authoredA1BogieWorldAfter.centerZ,\n    bogieGroundContactAxisT: authoredA1BogieWorldAfter.contactAxisT,\n    bogieGroundContactRotundaDistanceMeters: authoredA1BogieWorldAfter.rotundaDistance,\n    bogieGroundContactCabDistanceMeters: authoredA1BogieWorldAfter.cabDistance,\n    bogieWheelSeparationMeters: authoredA1BogieWorldAfter.wheelSeparationMeters,\n    bogieWheelTriangleCount: authoredA1BogieWorldAfter.wheelTriangleCount,`);
}

if (!source.includes("uploadedJetwayBogieGroundContactAuthority")) {
  const publicationAnchor = "  group.userData.uploadedJetwayBogieTireContactCorrectionMeters = report.bogieTireContactCorrectionMeters;";
  if (!source.includes(publicationAnchor)) throw new Error(`${installationPath}: wheel-pair report publication anchor is missing`);
  source = source.replace(publicationAnchor, `${publicationAnchor}\n  group.userData.uploadedJetwayA1BogieGroundOffsetMeters = report.a1BogieGroundOffsetMeters;\n  group.userData.uploadedJetwayBogieGroundClearanceMeters = report.bogieGroundClearanceMeters;\n  group.userData.uploadedJetwayBogieGroundContactAuthority = report.bogieGroundContactAuthority;\n  group.userData.uploadedJetwayBogieGroundContactPointCount = report.bogieGroundContactPointCount;\n  group.userData.uploadedJetwayBogieGroundContactClusterCount = report.bogieGroundContactClusterCount;\n  group.userData.uploadedJetwayBogieGroundContactSpanX = report.bogieGroundContactSpanX;\n  group.userData.uploadedJetwayBogieGroundContactSpanZ = report.bogieGroundContactSpanZ;\n  group.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters = report.bogieGroundHorizontalContactSpanMeters;\n  group.userData.uploadedJetwayBogieGroundContactCenterX = report.bogieGroundContactCenterX;\n  group.userData.uploadedJetwayBogieGroundContactCenterY = report.bogieGroundContactCenterY;\n  group.userData.uploadedJetwayBogieGroundContactCenterZ = report.bogieGroundContactCenterZ;\n  group.userData.uploadedJetwayBogieGroundContactAxisT = report.bogieGroundContactAxisT;\n  group.userData.uploadedJetwayBogieGroundContactRotundaDistanceMeters = report.bogieGroundContactRotundaDistanceMeters;\n  group.userData.uploadedJetwayBogieGroundContactCabDistanceMeters = report.bogieGroundContactCabDistanceMeters;\n  group.userData.uploadedJetwayBogieWheelSeparationMeters = report.bogieWheelSeparationMeters;\n  group.userData.uploadedJetwayBogieWheelTriangleCount = report.bogieWheelTriangleCount;`);
}

for (const required of [
  authority,
  "const bogieMesh = a1Model.getObjectByName(\"Tunnel_C_Jetway_0\")",
  "triangleCount < 900 || triangleCount > 1300",
  "candidates.length !== 2",
  "contactAxisT < 0.58",
  "a1Anchor.position.y += measuredA1BogieGroundOffsetMeters",
  "const finalBogieWorldClearanceMeters = authoredA1BogieWorldAfter.minimumY",
  "uploadedJetwayBogieGroundContactAxisT",
]) if (!source.includes(required)) throw new Error(`${installationPath}: exact authored wheel-pair grounding is missing ${required}`);

for (const forbidden of [
  "const bogieRoot = a1Model.getObjectByName(\"Tunnel_C\")",
  "fleet.position.y += measuredBogieGroundOffsetMeters",
  ...retiredAuthorities,
]) if (source.includes(forbidden)) throw new Error(`${installationPath}: retired A1 bogie semantics remain: ${forbidden}`);

fs.writeFileSync(installationPath, source, "utf8");
console.log("Grounded A1 from the exact connected authored Tunnel-C wheel pair, scoped the correction to the A1 anchor, and fail-closed the final wheel contact to the aircraft side of the bridge.");
