import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");
const marker = "a1-apron-side-close-evidence-camera-v1";

const oldCameraVector = `            const exactA1JointViewUnitX = -exactA1JointThroughUnitZ;
            const exactA1JointViewUnitZ = exactA1JointThroughUnitX;
            const exactA1JointCameraOutX = -exactA1JointViewUnitX;
            const exactA1JointCameraOutZ = -exactA1JointViewUnitZ;
            const exactA1JointCameraDistance = 14.0;`;
const newCameraVector = `            // ${marker}
            const exactA1JointViewUnitX = -exactA1JointThroughUnitZ;
            const exactA1JointViewUnitZ = exactA1JointThroughUnitX;
            const exactA1JointNormalTerminalDot = exactA1JointViewUnitX * exactA1JointWallUnitX
              + exactA1JointViewUnitZ * exactA1JointWallUnitZ;
            const exactA1JointApronNormalSign = exactA1JointNormalTerminalDot < 0 ? 1 : -1;
            const exactA1JointApronNormalX = exactA1JointViewUnitX * exactA1JointApronNormalSign;
            const exactA1JointApronNormalZ = exactA1JointViewUnitZ * exactA1JointApronNormalSign;
            const exactA1JointBiasedOutX = exactA1JointApronNormalX - exactA1JointWallUnitX * 0.40;
            const exactA1JointBiasedOutZ = exactA1JointApronNormalZ - exactA1JointWallUnitZ * 0.40;
            const exactA1JointBiasedOutLength = Math.hypot(exactA1JointBiasedOutX, exactA1JointBiasedOutZ);
            if (!(exactA1JointBiasedOutLength > 0.5)) {
              throw new Error(\`A1 passenger-joint apron-side camera vector collapsed: \${exactA1JointBiasedOutLength}\`);
            }
            const exactA1JointCameraOutX = exactA1JointBiasedOutX / exactA1JointBiasedOutLength;
            const exactA1JointCameraOutZ = exactA1JointBiasedOutZ / exactA1JointBiasedOutLength;
            const exactA1JointCameraDistance = 14.0;
            const exactA1JointApronHalfPlaneOffset = -(
              exactA1JointCameraOutX * exactA1JointWallUnitX
                + exactA1JointCameraOutZ * exactA1JointWallUnitZ
            ) * exactA1JointCameraDistance;
            if (!(exactA1JointApronHalfPlaneOffset > 2.5)) {
              throw new Error(\`A1 passenger-joint camera did not clear the terminal half-plane: \${exactA1JointApronHalfPlaneOffset}\`);
            }`;

if (!source.includes(marker)) {
  if (!source.includes(oldCameraVector)) {
    console.log("A1 apron-side evidence-camera normalization deferred: source-through-axis close camera has not been generated yet.");
    process.exit(0);
  }
  source = source.replace(oldCameraVector, newCameraVector);
  source = source.replaceAll(
    `exactA1JointViewUnitX * exactA1JointWallUnitX
                + exactA1JointViewUnitZ * exactA1JointWallUnitZ`,
    `exactA1JointCameraOutX * exactA1JointWallUnitX
                + exactA1JointCameraOutZ * exactA1JointWallUnitZ`,
  );
  source = source.replaceAll(
    `exactA1JointViewUnitX * exactA1JointCabUnitX
                + exactA1JointViewUnitZ * exactA1JointCabUnitZ`,
    `exactA1JointCameraOutX * exactA1JointCabUnitX
                + exactA1JointCameraOutZ * exactA1JointCabUnitZ`,
  );
  source = source.replace(
    "            const exactA1JointApronDistance = 0;",
    "            const exactA1JointApronDistance = exactA1JointApronHalfPlaneOffset;",
  );
  source = source.replace(
    `            renderer.domElement.dataset.inspectionCameraEndpointJointBranchViewImbalance = exactA1JointBranchViewImbalance.toFixed(6);`,
    `            renderer.domElement.dataset.inspectionCameraEndpointJointBranchViewImbalance = exactA1JointBranchViewImbalance.toFixed(6);\n            renderer.domElement.dataset.inspectionCameraEndpointJointApronHalfPlaneOffsetMeters = exactA1JointApronHalfPlaneOffset.toFixed(6);`,
  );
}

const bogieStartToken = '          } else if (exactA1EvidenceSubview === "bogie-contact") {';
const subviewPublishToken = "          renderer.domElement.dataset.inspectionCameraEndpointSubview = exactA1EvidenceSubview;";
const bogieStart = source.indexOf(bogieStartToken);
const subviewPublish = source.indexOf(subviewPublishToken, bogieStart + bogieStartToken.length);
if (bogieStart < 0 || subviewPublish < 0) {
  throw new Error(`${trainerPath}: generated A1 bogie-close block is missing`);
}
const bogieBlock = `          } else if (exactA1EvidenceSubview === "bogie-contact") {
            if (!exactA1BogieContactReady) {
              throw new Error("A1 bogie-contact close camera is missing the exact authored low-contact centroid");
            }
            const exactA1BogieWallX = exactA1CameraWallX - exactA1CameraRotundaX;
            const exactA1BogieWallZ = exactA1CameraWallZ - exactA1CameraRotundaZ;
            const exactA1BogieWallSpan = Math.hypot(exactA1BogieWallX, exactA1BogieWallZ);
            const exactA1BogieCabX = exactA1CameraCabX - exactA1CameraRotundaX;
            const exactA1BogieCabZ = exactA1CameraCabZ - exactA1CameraRotundaZ;
            const exactA1BogieCabSpan = Math.hypot(exactA1BogieCabX, exactA1BogieCabZ);
            if (!(exactA1BogieWallSpan > 0.5 && exactA1BogieCabSpan > 8)) {
              throw new Error(\`A1 bogie close camera received invalid source-axis spans: wall=\${exactA1BogieWallSpan} cab=\${exactA1BogieCabSpan}\`);
            }
            const exactA1BogieWallUnitX = exactA1BogieWallX / exactA1BogieWallSpan;
            const exactA1BogieWallUnitZ = exactA1BogieWallZ / exactA1BogieWallSpan;
            const exactA1BogieCabUnitX = exactA1BogieCabX / exactA1BogieCabSpan;
            const exactA1BogieCabUnitZ = exactA1BogieCabZ / exactA1BogieCabSpan;
            const exactA1BogieThroughX = exactA1BogieCabUnitX - exactA1BogieWallUnitX;
            const exactA1BogieThroughZ = exactA1BogieCabUnitZ - exactA1BogieWallUnitZ;
            const exactA1BogieThroughLength = Math.hypot(exactA1BogieThroughX, exactA1BogieThroughZ);
            const exactA1BogieNormalX = -exactA1BogieThroughZ / exactA1BogieThroughLength;
            const exactA1BogieNormalZ = exactA1BogieThroughX / exactA1BogieThroughLength;
            const exactA1BogieNormalTerminalDot = exactA1BogieNormalX * exactA1BogieWallUnitX
              + exactA1BogieNormalZ * exactA1BogieWallUnitZ;
            const exactA1BogieApronSign = exactA1BogieNormalTerminalDot < 0 ? 1 : -1;
            const exactA1BogieApronNormalX = exactA1BogieNormalX * exactA1BogieApronSign;
            const exactA1BogieApronNormalZ = exactA1BogieNormalZ * exactA1BogieApronSign;
            const exactA1BogieOutX = exactA1BogieApronNormalX - exactA1BogieWallUnitX * 0.40;
            const exactA1BogieOutZ = exactA1BogieApronNormalZ - exactA1BogieWallUnitZ * 0.40;
            const exactA1BogieOutLength = Math.hypot(exactA1BogieOutX, exactA1BogieOutZ);
            const exactA1BogieCameraOutX = exactA1BogieOutX / exactA1BogieOutLength;
            const exactA1BogieCameraOutZ = exactA1BogieOutZ / exactA1BogieOutLength;
            const exactA1BogieViewDistance = 8.0;
            const exactA1BogieApronHalfPlaneOffset = -(
              exactA1BogieCameraOutX * exactA1BogieWallUnitX
                + exactA1BogieCameraOutZ * exactA1BogieWallUnitZ
            ) * exactA1BogieViewDistance;
            if (!(exactA1BogieApronHalfPlaneOffset > 1.5)) {
              throw new Error(\`A1 bogie close camera did not clear the terminal half-plane: \${exactA1BogieApronHalfPlaneOffset}\`);
            }
            exactA1CameraPositionX = exactA1BogieContactX + exactA1BogieCameraOutX * exactA1BogieViewDistance;
            exactA1CameraPositionY = exactA1BogieContactY + 2.75;
            exactA1CameraPositionZ = exactA1BogieContactZ + exactA1BogieCameraOutZ * exactA1BogieViewDistance;
            exactA1CameraTargetX = exactA1BogieContactX;
            exactA1CameraTargetY = exactA1BogieContactY + 0.78;
            exactA1CameraTargetZ = exactA1BogieContactZ;
            const exactA1AircraftCenter = exactA1CameraAircraftBounds.getCenter(new THREE.Vector3());
            renderer.domElement.dataset.inspectionCameraEndpointBogieContactCenter = [
              exactA1BogieContactX, exactA1BogieContactY, exactA1BogieContactZ,
            ].map((value) => value.toFixed(6)).join(",");
            renderer.domElement.dataset.inspectionCameraEndpointBogieAircraftCenter = exactA1AircraftCenter
              .toArray().map((value) => value.toFixed(6)).join(",");
            renderer.domElement.dataset.inspectionCameraEndpointBogieApronHalfPlaneOffsetMeters = exactA1BogieApronHalfPlaneOffset.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointBogieProfileAuthority = "a1-tunnel-c-bogie-apron-half-plane-side-profile-v2";
          }
`;
source = `${source.slice(0, bogieStart)}${bogieBlock}${source.slice(subviewPublish)}`;

const diagnosticMarker = "          // a1-terminal-joint-rendered-ray-diagnostic-v1";
const lockToken = "          renderer.domElement.dataset.inspectionCameraEndpointLockAuthority";
const diagnosticStart = source.indexOf(diagnosticMarker);
const lockStart = source.indexOf(lockToken, diagnosticStart + diagnosticMarker.length);
if (diagnosticStart < 0 || lockStart < 0) {
  throw new Error(`${trainerPath}: late A1 camera mirror diagnostic block is missing`);
}
const validationBlock = `          // a1-terminal-joint-apron-half-plane-rendered-validation-v2
          if (exactA1EvidenceSubview === "terminal-joint") {
            const exactA1RenderedWallX = exactA1CameraWallX - exactA1CameraRotundaX;
            const exactA1RenderedWallZ = exactA1CameraWallZ - exactA1CameraRotundaZ;
            const exactA1RenderedWallSpan = Math.hypot(exactA1RenderedWallX, exactA1RenderedWallZ);
            const exactA1RenderedWallUnitX = exactA1RenderedWallX / exactA1RenderedWallSpan;
            const exactA1RenderedWallUnitZ = exactA1RenderedWallZ / exactA1RenderedWallSpan;
            const exactA1RenderedCameraOffsetX = camera.position.x - exactA1CameraRotundaX;
            const exactA1RenderedCameraOffsetZ = camera.position.z - exactA1CameraRotundaZ;
            const exactA1RenderedApronHalfPlaneOffset = -(
              exactA1RenderedCameraOffsetX * exactA1RenderedWallUnitX
                + exactA1RenderedCameraOffsetZ * exactA1RenderedWallUnitZ
            );
            if (!(exactA1RenderedApronHalfPlaneOffset > 2.5)) {
              throw new Error(\`A1 terminal-joint evidence camera entered the terminal half-plane: \${exactA1RenderedApronHalfPlaneOffset}\`);
            }
            const isAuthoredT4WalkHit = (hit) => {
              let cursor = hit?.object || null;
              for (let depth = 0; cursor && depth < 8; depth += 1, cursor = cursor.parent) {
                if (/T4_WALK/i.test(cursor.name || "")) return true;
              }
              const materials = Array.isArray(hit?.object?.material) ? hit.object.material : [hit?.object?.material];
              return materials.some((material) => /T4_WALK/i.test(material?.name || ""));
            };
            camera.updateMatrixWorld(true);
            const exactA1JointTargetDistance = camera.position.distanceTo(cameraTarget);
            const frameProbeCoordinates = [[-0.38,0.40],[-0.19,0.30],[0,0.30],[0.19,0.30],[0.38,0.40],[0,0]];
            const nearFieldWalkwayHits = [];
            const frameProbeRaycaster = new THREE.Raycaster();
            for (const [x, y] of frameProbeCoordinates) {
              frameProbeRaycaster.setFromCamera(new THREE.Vector2(x, y), camera);
              const blocker = frameProbeRaycaster.intersectObjects(scene.children, true)
                .find((hit) => hit?.object?.visible !== false
                  && hit.distance < exactA1JointTargetDistance - 0.45
                  && isAuthoredT4WalkHit(hit));
              if (blocker) nearFieldWalkwayHits.push({ x, y, name: blocker.object?.name || "unnamed", distance: Number(blocker.distance.toFixed(4)) });
            }
            if (nearFieldWalkwayHits.length) {
              throw new Error(\`A1 apron-side terminal-joint frame still has near-field T4_WALK coverage: \${JSON.stringify(nearFieldWalkwayHits)}\`);
            }
            renderer.domElement.dataset.inspectionCameraEndpointJointClearSideAuthority = "a1-terminal-joint-apron-half-plane-unoccluded-v3";
            renderer.domElement.dataset.inspectionCameraEndpointJointClearSideFlipped = "false";
            renderer.domElement.dataset.inspectionCameraEndpointJointT4WalkOccluded = "false";
            renderer.domElement.dataset.inspectionCameraEndpointJointRenderedApronHalfPlaneOffsetMeters = exactA1RenderedApronHalfPlaneOffset.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointNearFieldProbeCount = String(frameProbeCoordinates.length);
          }
`;
source = `${source.slice(0, diagnosticStart)}${validationBlock}${source.slice(lockStart)}`;
source = source.replace(
  /renderer\.domElement\.dataset\.inspectionCameraEndpointSubviewAuthority = "[^"]+";/,
  'renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "source-measured-a1-apron-side-evidence-camera-v4";',
);

for (const forbidden of [
  "const generatedBisectorCamera = camera.position.clone();",
  "const clearSideCandidate = new THREE.Vector3(",
  'inspectionCameraEndpointJointClearSideFlipped = "true"',
  "const exactA1BogieAwayFromAircraftX =",
  "exactA1BogieAircraftOppositionCosine < -0.65",
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: terminal-side evidence camera logic remains: ${forbidden}`);
}
for (const required of [
  marker,
  "exactA1JointApronHalfPlaneOffset > 2.5",
  "exactA1BogieApronHalfPlaneOffset > 1.5",
  "a1-terminal-joint-apron-half-plane-rendered-validation-v2",
  'inspectionCameraEndpointJointClearSideFlipped = "false"',
  "inspectionCameraEndpointJointRenderedApronHalfPlaneOffsetMeters",
  "a1-tunnel-c-bogie-apron-half-plane-side-profile-v2",
]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: apron-side evidence camera is missing ${required}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared A1 close evidence on the apron half-plane: terminal-joint and Tunnel-C bogie cameras stay side-on and the late mirror-into-terminal path is forbidden.");
