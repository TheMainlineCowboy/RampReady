import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const authority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const legacyAuthorities = [
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
];
const finalWorldRefreshMarker = "A1 final transformed Tunnel-C bogie world-contact refresh v4";
const fixedOffsetPattern = /  fleet\.position\.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;\n  fleet\.updateMatrixWorld\(true\);/;

const measuredOffsetBlock = `  // ${authority}
  // Ground A1 from the AIRCRAFT-SIDE support assembly, not from the lowest
  // point anywhere in the complete jetway. The Rotunda pedestal can already
  // touch the ramp while the Tunnel-C bogie/wheels remain meters in the air.
  const bogieRoot = a1Model.getObjectByName("Tunnel_C")
    || a1Model.getObjectByName("Tunnel_C_Jetway_0");
  if (!bogieRoot) throw new Error("A1 exact supplied jetway is missing Tunnel_C bogie/support geometry");

  const measureAuthoredA1BogieContact = (coordinateSpace = "fleet-parent") => {
    if (coordinateSpace !== "fleet-parent" && coordinateSpace !== "world") {
      throw new Error(\`Unsupported A1 bogie coordinate space: \${coordinateSpace}\`);
    }
    group.updateWorldMatrix(true, true);
    fleet.updateWorldMatrix(true, true);
    a1Model.updateWorldMatrix(true, true);
    bogieRoot.updateWorldMatrix(true, true);
    const fleetParent = fleet.parent;
    if (!fleetParent?.matrixWorld) throw new Error("A1 exact jetway fleet has no matrix-bearing parent");
    const fleetParentWorldInverse = new THREE.Matrix4().copy(fleetParent.matrixWorld).invert();
    const point = new THREE.Vector3();
    const readPoint = (object, position, index) => {
      point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      if (coordinateSpace === "fleet-parent") point.applyMatrix4(fleetParentWorldInverse);
      return point;
    };

    let minimumY = Number.POSITIVE_INFINITY;
    let authoredVertexCount = 0;
    bogieRoot.traverse((object) => {
      if (!object?.isMesh || object.visible === false) return;
      const position = object.geometry?.getAttribute?.("position");
      if (!position) return;
      object.updateWorldMatrix(true, false);
      for (let index = 0; index < position.count; index += 1) {
        readPoint(object, position, index);
        minimumY = Math.min(minimumY, point.y);
        authoredVertexCount += 1;
      }
    });
    if (!Number.isFinite(minimumY) || authoredVertexCount < 100) {
      throw new Error(\`A1 Tunnel-C bogie scan is invalid: minimum=\${minimumY}, vertices=\${authoredVertexCount}\`);
    }

    const contactBandMeters = 0.10;
    const cellSizeMeters = 0.22;
    const contactBounds = new THREE.Box3();
    const occupiedCells = new Set();
    let contactPointCount = 0;
    bogieRoot.traverse((object) => {
      if (!object?.isMesh || object.visible === false) return;
      const position = object.geometry?.getAttribute?.("position");
      if (!position) return;
      object.updateWorldMatrix(true, false);
      for (let index = 0; index < position.count; index += 1) {
        readPoint(object, position, index);
        if (point.y > minimumY + contactBandMeters) continue;
        contactBounds.expandByPoint(point);
        occupiedCells.add([
          Math.floor(point.x / cellSizeMeters),
          Math.floor(point.z / cellSizeMeters),
        ].join(","));
        contactPointCount += 1;
      }
    });

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
    if (contactBounds.isEmpty()
      || contactPointCount < 4
      || contactClusterCount < 1
      || horizontalContactSpanMeters < 0.35
      || ![contactCenter.x, contactCenter.y, contactCenter.z].every(Number.isFinite)) {
      throw new Error(\`A1 Tunnel-C bogie does not expose a credible ramp footprint: points=\${contactPointCount}, clusters=\${contactClusterCount}, span=\${contactSpan.x}x\${contactSpan.z}\`);
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
      minimumX: contactBounds.min.x,
      minimumZ: contactBounds.min.z,
      maximumX: contactBounds.max.x,
      maximumZ: contactBounds.max.z,
    });
  };

  const authoredA1BogieBefore = measureAuthoredA1BogieContact("fleet-parent");
  const measuredBogieGroundOffsetMeters = -authoredA1BogieBefore.minimumY;
  if (!Number.isFinite(measuredBogieGroundOffsetMeters) || Math.abs(measuredBogieGroundOffsetMeters) > 8) {
    throw new Error(\`A1 Tunnel-C bogie ground offset is invalid: \${measuredBogieGroundOffsetMeters}\`);
  }
  fleet.position.y += measuredBogieGroundOffsetMeters;
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  a1Model.updateWorldMatrix(true, true);
  bogieRoot.updateWorldMatrix(true, true);

  const authoredA1BogieAfter = measureAuthoredA1BogieContact("fleet-parent");
  const measuredBogieGroundClearanceMeters = authoredA1BogieAfter.minimumY;
  if (Math.abs(measuredBogieGroundClearanceMeters) > 0.015) {
    throw new Error(\`A1 Tunnel-C bogie missed the ramp plane by \${measuredBogieGroundClearanceMeters} m\`);
  }
  let authoredA1BogieWorldAfter = measureAuthoredA1BogieContact("world");`;

if (fixedOffsetPattern.test(source)) {
  source = source.replace(fixedOffsetPattern, measuredOffsetBlock);
} else {
  const priorBlockPattern = /  \/\/ exact-authored-a1-lowest-geometry-ramp-contact-v2[\s\S]*?  let authoredA1GroundContactWorldAfter = measureAuthoredA1RampContact\("world"\);/;
  if (priorBlockPattern.test(source)) source = source.replace(priorBlockPattern, measuredOffsetBlock);
  else if (!source.includes(authority)) throw new Error(`${installationPath}: A1 ground-contact block could not be replaced safely`);
}

for (const legacy of legacyAuthorities) source = source.replaceAll(legacy, authority);
source = source
  .replaceAll("authoredA1GroundContactAfter", "authoredA1BogieAfter")
  .replaceAll("authoredA1GroundContactWorldAfter", "authoredA1BogieWorldAfter")
  .replaceAll("measureAuthoredA1RampContact", "measureAuthoredA1BogieContact")
  .replaceAll("A1 final transformed world-space ground-contact refresh v3", finalWorldRefreshMarker);

if (!source.includes("const finalBogieWorldClearanceMeters = authoredA1BogieWorldAfter.minimumY")) {
  const finalAnchor = "  const doubleSidedMaterialCount = forceExactMaterialsDoubleSided(THREE, fleet);";
  if (!source.includes(finalAnchor)) throw new Error(`${installationPath}: final bogie-world check anchor is missing`);
  const finalCheck = `  // final rendered Tunnel-C bogie ramp truth\n  group.updateWorldMatrix(true, true);\n  fleet.updateWorldMatrix(true, true);\n  a1Model.updateWorldMatrix(true, true);\n  bogieRoot.updateWorldMatrix(true, true);\n  authoredA1BogieWorldAfter = measureAuthoredA1BogieContact("world");\n  const finalBogieWorldClearanceMeters = authoredA1BogieWorldAfter.minimumY;\n  if (Math.abs(finalBogieWorldClearanceMeters) > 0.015) {\n    throw new Error(\`A1 FINAL visible Tunnel-C bogie is not on the ramp: \${finalBogieWorldClearanceMeters} m\`);\n  }\n`;
  source = source.replace(finalAnchor, `${finalCheck}${finalAnchor}`);
}

source = source.replace(/bogieGroundContactAuthority: "[^"]+"/, `bogieGroundContactAuthority: "${authority}"`);

if (!source.includes("uploadedJetwayBogieGroundContactAuthority")) {
  const groupAnchor = `  group.userData.uploadedJetwayBogieTireContactCorrectionMeters = report.bogieTireContactCorrectionMeters;`;
  if (!source.includes(groupAnchor)) throw new Error(`${installationPath}: bogie report publication anchor is missing`);
  source = source.replace(
    groupAnchor,
    `${groupAnchor}\n  group.userData.uploadedJetwayBogieGroundClearanceMeters = report.bogieGroundClearanceMeters;\n  group.userData.uploadedJetwayBogieGroundContactAuthority = report.bogieGroundContactAuthority;\n  group.userData.uploadedJetwayBogieGroundContactPointCount = report.bogieGroundContactPointCount;\n  group.userData.uploadedJetwayBogieGroundContactClusterCount = report.bogieGroundContactClusterCount;\n  group.userData.uploadedJetwayBogieGroundContactSpanX = report.bogieGroundContactSpanX;\n  group.userData.uploadedJetwayBogieGroundContactSpanZ = report.bogieGroundContactSpanZ;\n  group.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters = report.bogieGroundHorizontalContactSpanMeters;\n  group.userData.uploadedJetwayBogieGroundContactCenterX = report.bogieGroundContactCenterX;\n  group.userData.uploadedJetwayBogieGroundContactCenterY = report.bogieGroundContactCenterY;\n  group.userData.uploadedJetwayBogieGroundContactCenterZ = report.bogieGroundContactCenterZ;`,
  );
}

for (const required of [
  authority,
  "const bogieRoot = a1Model.getObjectByName(\"Tunnel_C\")",
  "const measureAuthoredA1BogieContact = (coordinateSpace = \"fleet-parent\") =>",
  "const measuredBogieGroundOffsetMeters = -authoredA1BogieBefore.minimumY",
  "const finalBogieWorldClearanceMeters = authoredA1BogieWorldAfter.minimumY",
  "A1 FINAL visible Tunnel-C bogie is not on the ramp",
]) {
  if (!source.includes(required)) throw new Error(`${installationPath}: Tunnel-C bogie grounding is missing ${required}`);
}
for (const forbidden of [
  "fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS",
  "const measureAuthoredA1RampContact",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
]) {
  if (source.includes(forbidden)) throw new Error(`${installationPath}: obsolete whole-model ground authority remains: ${forbidden}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Grounded A1 from the supplied Tunnel-C aircraft-side bogie/support geometry and added a deterministic final world-space fail-closed ramp-clearance check after every A1 transform.");
