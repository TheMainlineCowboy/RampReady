import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-aircraft-side-reference-subviews-v1";
const subviewAuthority = "source-measured-a1-apron-side-evidence-camera-v5-balanced-branches";
const sideProfileAuthority = "a1-rotunda-cab-outboard-side-profile-v1";
const aircraftSideAuthority = "a1-cab-tunnel-c-aircraft-side-close-v1";
let source = fs.readFileSync(trainerPath, "utf8");

if (!source.includes(marker)) {
  const anchor = '          } else if (exactA1EvidenceSubview === "bogie-contact") {';
  const occurrences = source.split(anchor).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${trainerPath}: expected one final A1 bogie-contact subview branch, found ${occurrences}`);
  }

  const insertion = `          } else if (exactA1EvidenceSubview === "side-profile") {
            // ${marker}
            // Dedicated photo-judgement view: look perpendicular to the final
            // Rotunda-to-Cab movable-bridge axis from the same outboard half-plane
            // as the aircraft-side Cab. This prevents perspective overlap from
            // making the exact Tunnel-C stair/support mass look fused into the CRJ.
            const exactA1SideProfileAxisX = exactA1CameraCabX - exactA1CameraRotundaX;
            const exactA1SideProfileAxisZ = exactA1CameraCabZ - exactA1CameraRotundaZ;
            const exactA1SideProfileSpan = Math.hypot(exactA1SideProfileAxisX, exactA1SideProfileAxisZ);
            if (!(exactA1SideProfileSpan > 8 && exactA1SideProfileSpan < 44)) {
              throw new Error(\`A1 side-profile camera received invalid Rotunda-to-Cab span: \${exactA1SideProfileSpan}\`);
            }
            const exactA1SideProfileUnitX = exactA1SideProfileAxisX / exactA1SideProfileSpan;
            const exactA1SideProfileUnitZ = exactA1SideProfileAxisZ / exactA1SideProfileSpan;
            const exactA1SideProfileNormalX = exactA1SideProfileUnitZ;
            const exactA1SideProfileNormalZ = -exactA1SideProfileUnitX;
            const exactA1SideProfileAircraftCenter = exactA1CameraAircraftBounds.getCenter(new THREE.Vector3());
            const exactA1SideProfileCabFromAircraftX = exactA1CameraCabX - exactA1SideProfileAircraftCenter.x;
            const exactA1SideProfileCabFromAircraftZ = exactA1CameraCabZ - exactA1SideProfileAircraftCenter.z;
            const exactA1SideProfileOutboardDot = exactA1SideProfileCabFromAircraftX * exactA1SideProfileNormalX
              + exactA1SideProfileCabFromAircraftZ * exactA1SideProfileNormalZ;
            const exactA1SideProfileSign = exactA1SideProfileOutboardDot >= 0 ? 1 : -1;
            const exactA1SideProfileCenterX = (exactA1CameraRotundaX + exactA1CameraCabX) / 2;
            const exactA1SideProfileCenterY = (exactA1CameraRotundaY + exactA1CameraCabY) / 2;
            const exactA1SideProfileCenterZ = (exactA1CameraRotundaZ + exactA1CameraCabZ) / 2;
            const exactA1SideProfileDistance = Math.min(28, Math.max(20, exactA1SideProfileSpan * 1.55));
            exactA1CameraPositionX = exactA1SideProfileCenterX
              + exactA1SideProfileNormalX * exactA1SideProfileSign * exactA1SideProfileDistance;
            exactA1CameraPositionY = Math.max(7.2, exactA1SideProfileCenterY + 4.2);
            exactA1CameraPositionZ = exactA1SideProfileCenterZ
              + exactA1SideProfileNormalZ * exactA1SideProfileSign * exactA1SideProfileDistance;
            exactA1CameraTargetX = exactA1SideProfileCenterX;
            exactA1CameraTargetY = Math.max(3.1, exactA1SideProfileCenterY + 0.35);
            exactA1CameraTargetZ = exactA1SideProfileCenterZ;
            renderer.domElement.dataset.inspectionCameraEndpointSideProfileAuthority = "${sideProfileAuthority}";
            renderer.domElement.dataset.inspectionCameraEndpointSideProfileSpanMeters = exactA1SideProfileSpan.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointSideProfileDistanceMeters = exactA1SideProfileDistance.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointSideProfileOutboardDot = exactA1SideProfileOutboardDot.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointSideProfileSign = String(exactA1SideProfileSign);
          } else if (exactA1EvidenceSubview === "aircraft-side") {
            // Aircraft-side close evidence centers the final Cab/Tunnel-C region,
            // but stays on the same derived outboard half-plane as the side view.
            // The terminal, CRJ, Rotunda and exact supplied GLB geometry remain fixed.
            const exactA1AircraftSideAxisX = exactA1CameraCabX - exactA1CameraRotundaX;
            const exactA1AircraftSideAxisZ = exactA1CameraCabZ - exactA1CameraRotundaZ;
            const exactA1AircraftSideSpan = Math.hypot(exactA1AircraftSideAxisX, exactA1AircraftSideAxisZ);
            if (!(exactA1AircraftSideSpan > 8 && exactA1AircraftSideSpan < 44)) {
              throw new Error(\`A1 aircraft-side camera received invalid Rotunda-to-Cab span: \${exactA1AircraftSideSpan}\`);
            }
            const exactA1AircraftSideUnitX = exactA1AircraftSideAxisX / exactA1AircraftSideSpan;
            const exactA1AircraftSideUnitZ = exactA1AircraftSideAxisZ / exactA1AircraftSideSpan;
            const exactA1AircraftSideNormalX = exactA1AircraftSideUnitZ;
            const exactA1AircraftSideNormalZ = -exactA1AircraftSideUnitX;
            const exactA1AircraftSideAircraftCenter = exactA1CameraAircraftBounds.getCenter(new THREE.Vector3());
            const exactA1AircraftSideCabFromAircraftX = exactA1CameraCabX - exactA1AircraftSideAircraftCenter.x;
            const exactA1AircraftSideCabFromAircraftZ = exactA1CameraCabZ - exactA1AircraftSideAircraftCenter.z;
            const exactA1AircraftSideOutboardDot = exactA1AircraftSideCabFromAircraftX * exactA1AircraftSideNormalX
              + exactA1AircraftSideCabFromAircraftZ * exactA1AircraftSideNormalZ;
            const exactA1AircraftSideSign = exactA1AircraftSideOutboardDot >= 0 ? 1 : -1;
            const exactA1AircraftSideTargetWeight = 0.72;
            const exactA1AircraftSideTargetX = exactA1CameraRotundaX * (1 - exactA1AircraftSideTargetWeight)
              + exactA1CameraCabX * exactA1AircraftSideTargetWeight;
            const exactA1AircraftSideTargetY = exactA1CameraRotundaY * (1 - exactA1AircraftSideTargetWeight)
              + exactA1CameraCabY * exactA1AircraftSideTargetWeight;
            const exactA1AircraftSideTargetZ = exactA1CameraRotundaZ * (1 - exactA1AircraftSideTargetWeight)
              + exactA1CameraCabZ * exactA1AircraftSideTargetWeight;
            const exactA1AircraftSideDistance = 12.5;
            exactA1CameraPositionX = exactA1AircraftSideTargetX
              + exactA1AircraftSideNormalX * exactA1AircraftSideSign * exactA1AircraftSideDistance
              - exactA1AircraftSideUnitX * 1.8;
            exactA1CameraPositionY = Math.max(6.8, exactA1AircraftSideTargetY + 3.4);
            exactA1CameraPositionZ = exactA1AircraftSideTargetZ
              + exactA1AircraftSideNormalZ * exactA1AircraftSideSign * exactA1AircraftSideDistance
              - exactA1AircraftSideUnitZ * 1.8;
            exactA1CameraTargetX = exactA1AircraftSideTargetX;
            exactA1CameraTargetY = Math.max(3.1, exactA1AircraftSideTargetY + 0.35);
            exactA1CameraTargetZ = exactA1AircraftSideTargetZ;
            renderer.domElement.dataset.inspectionCameraEndpointAircraftSideAuthority = "${aircraftSideAuthority}";
            renderer.domElement.dataset.inspectionCameraEndpointAircraftSideSpanMeters = exactA1AircraftSideSpan.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointAircraftSideDistanceMeters = exactA1AircraftSideDistance.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointAircraftSideOutboardDot = exactA1AircraftSideOutboardDot.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointAircraftSideSign = String(exactA1AircraftSideSign);
`;
  source = source.replace(anchor, `${insertion}\n${anchor}`);
}

for (const required of [
  marker,
  'exactA1EvidenceSubview === "side-profile"',
  'exactA1EvidenceSubview === "aircraft-side"',
  `inspectionCameraEndpointSideProfileAuthority = "${sideProfileAuthority}"`,
  `inspectionCameraEndpointAircraftSideAuthority = "${aircraftSideAuthority}"`,
  `inspectionCameraEndpointSubviewAuthority = "${subviewAuthority}"`,
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: aircraft-side A1 evidence subviews are missing ${required}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker}: final A1 evidence now includes dedicated outboard side-profile and aircraft-side close cameras derived only from the final Rotunda, Cab and rendered-aircraft bounds.`);
