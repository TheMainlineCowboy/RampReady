import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-aircraft-side-reference-subviews-v1";
const bogieFramingMarker = "a1-bogie-contact-visible-outboard-camera-v3";
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

// The earlier bogie camera proved the correct low-contact footprint, but its
// camera itself sat nearly on the ramp underneath the integrated Tunnel-C shell.
// That produced a grey occluded frame even while the numerical contact test
// passed. Reframe only the evidence camera here, after final Tunnel-C measurement,
// from the same derived outboard half-plane used by the aircraft-side views.
if (!source.includes(bogieFramingMarker)) {
  const authorityAnchor = '            renderer.domElement.dataset.inspectionCameraEndpointBogieProfileAuthority = "a1-tunnel-c-bogie-apron-half-plane-side-profile-v2";';
  const occurrences = source.split(authorityAnchor).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${trainerPath}: expected one final bogie profile authority anchor, found ${occurrences}`);
  }
  const visibleBogieCamera = `            // ${bogieFramingMarker}
            const exactA1VisibleBogieAxisX = exactA1CameraCabX - exactA1CameraRotundaX;
            const exactA1VisibleBogieAxisZ = exactA1CameraCabZ - exactA1CameraRotundaZ;
            const exactA1VisibleBogieSpan = Math.hypot(exactA1VisibleBogieAxisX, exactA1VisibleBogieAxisZ);
            if (!(exactA1VisibleBogieSpan > 8 && exactA1VisibleBogieSpan < 44)) {
              throw new Error(\`A1 visible bogie camera received invalid Rotunda-to-Cab span: \${exactA1VisibleBogieSpan}\`);
            }
            const exactA1VisibleBogieUnitX = exactA1VisibleBogieAxisX / exactA1VisibleBogieSpan;
            const exactA1VisibleBogieUnitZ = exactA1VisibleBogieAxisZ / exactA1VisibleBogieSpan;
            const exactA1VisibleBogieNormalX = exactA1VisibleBogieUnitZ;
            const exactA1VisibleBogieNormalZ = -exactA1VisibleBogieUnitX;
            const exactA1VisibleBogieAircraftCenter = exactA1CameraAircraftBounds.getCenter(new THREE.Vector3());
            const exactA1VisibleBogieCabFromAircraftX = exactA1CameraCabX - exactA1VisibleBogieAircraftCenter.x;
            const exactA1VisibleBogieCabFromAircraftZ = exactA1CameraCabZ - exactA1VisibleBogieAircraftCenter.z;
            const exactA1VisibleBogieOutboardDot = exactA1VisibleBogieCabFromAircraftX * exactA1VisibleBogieNormalX
              + exactA1VisibleBogieCabFromAircraftZ * exactA1VisibleBogieNormalZ;
            const exactA1VisibleBogieSign = exactA1VisibleBogieOutboardDot >= 0 ? 1 : -1;
            // Preserve the prior v2 branch's already-proved Tunnel-C low-contact
            // target before replacing only the camera position/framing. This
            // avoids inventing a second bogie locator and keeps the camera tied
            // to the exact final visible support footprint.
            const exactA1VisibleBogieTargetX = exactA1CameraTargetX;
            const exactA1VisibleBogieTargetY = exactA1CameraTargetY;
            const exactA1VisibleBogieTargetZ = exactA1CameraTargetZ;
            if (![exactA1VisibleBogieTargetX, exactA1VisibleBogieTargetY, exactA1VisibleBogieTargetZ].every(Number.isFinite)) {
              throw new Error("A1 visible bogie camera received no finite measured Tunnel-C low-contact target");
            }
            const exactA1VisibleBogieDistance = 9.5;
            exactA1CameraPositionX = exactA1VisibleBogieTargetX
              + exactA1VisibleBogieNormalX * exactA1VisibleBogieSign * exactA1VisibleBogieDistance
              - exactA1VisibleBogieUnitX * 0.8;
            exactA1CameraPositionY = Math.max(exactA1VisibleBogieTargetY + 3.2, 3.8);
            exactA1CameraPositionZ = exactA1VisibleBogieTargetZ
              + exactA1VisibleBogieNormalZ * exactA1VisibleBogieSign * exactA1VisibleBogieDistance
              - exactA1VisibleBogieUnitZ * 0.8;
            exactA1CameraTargetX = exactA1VisibleBogieTargetX;
            exactA1CameraTargetY = exactA1VisibleBogieTargetY + 0.65;
            exactA1CameraTargetZ = exactA1VisibleBogieTargetZ;
            inspectionCamera.fov = 46;
            renderer.domElement.dataset.inspectionCameraEndpointBogieFramingAuthority = "${bogieFramingMarker}";
            renderer.domElement.dataset.inspectionCameraEndpointBogieFramingDistanceMeters = exactA1VisibleBogieDistance.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointBogieFramingHeightMeters = exactA1CameraPositionY.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointBogieFramingOutboardDot = exactA1VisibleBogieOutboardDot.toFixed(6);
${authorityAnchor}`;
  source = source.replace(authorityAnchor, visibleBogieCamera);
}

for (const required of [
  marker,
  bogieFramingMarker,
  'exactA1EvidenceSubview === "side-profile"',
  'exactA1EvidenceSubview === "aircraft-side"',
  `inspectionCameraEndpointSideProfileAuthority = "${sideProfileAuthority}"`,
  `inspectionCameraEndpointAircraftSideAuthority = "${aircraftSideAuthority}"`,
  `inspectionCameraEndpointBogieFramingAuthority = "${bogieFramingMarker}"`,
  `inspectionCameraEndpointSubviewAuthority = "${subviewAuthority}"`,
  'const exactA1VisibleBogieTargetX = exactA1CameraTargetX;',
  'const exactA1VisibleBogieDistance = 9.5;',
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: aircraft-side A1 evidence subviews are missing ${required}`);
  }
}

for (const forbidden of [
  'exactA1TunnelCLowCenter.x',
  'exactA1TunnelCLowCenter.y',
  'exactA1TunnelCLowCenter.z',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: stale undefined bogie camera target survived: ${forbidden}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker} + ${bogieFramingMarker}: final A1 evidence includes dedicated outboard side-profile, aircraft-side and visibly elevated bogie-contact cameras derived only from final Rotunda/Cab/aircraft bounds and the measured Tunnel-C low-contact footprint.`);
