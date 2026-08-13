import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-world-tunnel-c-bogie-camera-v1";
const authority = "final-visible-a1-tunnel-c-low-contact-world-v1";
let source = fs.readFileSync(trainerPath, "utf8");

if (!source.includes(marker)) {
  const oldBlock = `          const exactA1BogieContactX = Number(
            exactA1CameraFleet?.userData?.uploadedJetwayBogieGroundContactCenterX,
          );
          const exactA1BogieContactY = Number(
            exactA1CameraFleet?.userData?.uploadedJetwayBogieGroundContactCenterY,
          );
          const exactA1BogieContactZ = Number(
            exactA1CameraFleet?.userData?.uploadedJetwayBogieGroundContactCenterZ,
          );
          const exactA1BogieContactReady = [
            exactA1BogieContactX,
            exactA1BogieContactY,
            exactA1BogieContactZ,
          ].every(Number.isFinite);`;

  const newBlock = `          // ${marker}
          // The installation report's Tunnel-C contact center is measured before
          // Terminal 4 receives its final scene transform. It is valid for the
          // grounding invariant but its X/Z cannot be used as final camera world
          // coordinates. Re-measure the VISIBLE Tunnel_C mesh after every parent
          // transform so the evidence camera proves the actual aircraft-side
          // wheel/support truck instead of the Rotunda pedestal.
          let exactA1BogieContactX = Number(
            exactA1CameraFleet?.userData?.uploadedJetwayBogieGroundContactCenterX,
          );
          let exactA1BogieContactY = Number(
            exactA1CameraFleet?.userData?.uploadedJetwayBogieGroundContactCenterY,
          );
          let exactA1BogieContactZ = Number(
            exactA1CameraFleet?.userData?.uploadedJetwayBogieGroundContactCenterZ,
          );
          let exactA1BogieContactReady = false;
          let exactA1BogieFinalWorldPointCount = 0;
          let exactA1BogieFinalWorldHorizontalSpan = 0;
          let exactA1BogieFinalWorldAlongBridgeMeters = Number.NaN;
          let exactA1BogieFinalWorldAlongBridgeRatio = Number.NaN;
          let exactA1BogieFinalWorldLateralOffsetMeters = Number.NaN;
          let exactA1BogieFinalWorldMinimumY = Number.NaN;
          if (exactA1EvidenceSubview === "bogie-contact") {
            const exactA1VisibleAnchor = exactA1CameraFleet?.getObjectByName?.("UploadedAirportJetway_A1");
            const exactA1VisibleModel = exactA1VisibleAnchor?.getObjectByName?.("UploadedAirportJetwayModel_A1");
            const exactA1VisibleTunnelC = exactA1VisibleModel?.getObjectByName?.("Tunnel_C")
              || exactA1VisibleModel?.getObjectByName?.("Tunnel_C_Jetway_0");
            if (!exactA1VisibleAnchor || !exactA1VisibleModel || !exactA1VisibleTunnelC) {
              throw new Error("A1 final-world bogie evidence cannot resolve the visible Tunnel_C hierarchy");
            }
            exactA1VisibleAnchor.updateWorldMatrix(true, true);
            exactA1VisibleModel.updateWorldMatrix(true, true);
            exactA1VisibleTunnelC.updateWorldMatrix(true, true);
            let exactA1TunnelCMinimumY = Number.POSITIVE_INFINITY;
            let exactA1TunnelCVertexCount = 0;
            const exactA1TunnelCWorldVertex = new THREE.Vector3();
            exactA1VisibleTunnelC.traverse((object) => {
              if (!object.isMesh || !object.geometry?.attributes?.position) return;
              object.updateWorldMatrix(true, false);
              const position = object.geometry.attributes.position;
              for (let index = 0; index < position.count; index += 1) {
                exactA1TunnelCWorldVertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
                if (!Number.isFinite(exactA1TunnelCWorldVertex.y)) continue;
                exactA1TunnelCMinimumY = Math.min(exactA1TunnelCMinimumY, exactA1TunnelCWorldVertex.y);
                exactA1TunnelCVertexCount += 1;
              }
            });
            if (!(Number.isFinite(exactA1TunnelCMinimumY) && exactA1TunnelCVertexCount >= 100)) {
              throw new Error(\`A1 final-world Tunnel_C minimum cannot be measured: minY=\${exactA1TunnelCMinimumY} vertices=\${exactA1TunnelCVertexCount}\`);
            }
            const exactA1TunnelCLowBand = new THREE.Box3();
            let exactA1TunnelCLowPointCount = 0;
            exactA1VisibleTunnelC.traverse((object) => {
              if (!object.isMesh || !object.geometry?.attributes?.position) return;
              object.updateWorldMatrix(true, false);
              const position = object.geometry.attributes.position;
              for (let index = 0; index < position.count; index += 1) {
                exactA1TunnelCWorldVertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
                if (exactA1TunnelCWorldVertex.y <= exactA1TunnelCMinimumY + 0.10) {
                  exactA1TunnelCLowBand.expandByPoint(exactA1TunnelCWorldVertex);
                  exactA1TunnelCLowPointCount += 1;
                }
              }
            });
            if (exactA1TunnelCLowBand.isEmpty() || exactA1TunnelCLowPointCount < 4) {
              throw new Error(\`A1 final-world Tunnel_C has no usable low-contact cluster: points=\${exactA1TunnelCLowPointCount}\`);
            }
            const exactA1TunnelCLowCenter = exactA1TunnelCLowBand.getCenter(new THREE.Vector3());
            const exactA1TunnelCLowSize = exactA1TunnelCLowBand.getSize(new THREE.Vector3());
            const exactA1TunnelCHorizontalSpan = Math.hypot(exactA1TunnelCLowSize.x, exactA1TunnelCLowSize.z);
            const exactA1TunnelCBridgeX = exactA1CameraCabX - exactA1CameraRotundaX;
            const exactA1TunnelCBridgeZ = exactA1CameraCabZ - exactA1CameraRotundaZ;
            const exactA1TunnelCBridgeSpan = Math.hypot(exactA1TunnelCBridgeX, exactA1TunnelCBridgeZ);
            if (!(exactA1TunnelCBridgeSpan > 8)) {
              throw new Error(\`A1 final-world bogie evidence has invalid Rotunda-to-Cab span: \${exactA1TunnelCBridgeSpan}\`);
            }
            const exactA1TunnelCBridgeUnitX = exactA1TunnelCBridgeX / exactA1TunnelCBridgeSpan;
            const exactA1TunnelCBridgeUnitZ = exactA1TunnelCBridgeZ / exactA1TunnelCBridgeSpan;
            const exactA1TunnelCFromRotundaX = exactA1TunnelCLowCenter.x - exactA1CameraRotundaX;
            const exactA1TunnelCFromRotundaZ = exactA1TunnelCLowCenter.z - exactA1CameraRotundaZ;
            const exactA1TunnelCAlongBridge = exactA1TunnelCFromRotundaX * exactA1TunnelCBridgeUnitX
              + exactA1TunnelCFromRotundaZ * exactA1TunnelCBridgeUnitZ;
            const exactA1TunnelCLateralOffset = Math.abs(
              exactA1TunnelCFromRotundaX * exactA1TunnelCBridgeUnitZ
                - exactA1TunnelCFromRotundaZ * exactA1TunnelCBridgeUnitX,
            );
            const exactA1TunnelCAlongRatio = exactA1TunnelCAlongBridge / exactA1TunnelCBridgeSpan;
            if (!(exactA1TunnelCHorizontalSpan >= 0.35)) {
              throw new Error(\`A1 final-world Tunnel_C low cluster is too small to be the bogie/support truck: span=\${exactA1TunnelCHorizontalSpan}\`);
            }
            if (!(exactA1TunnelCAlongRatio > 0.40 && exactA1TunnelCAlongRatio < 0.88)) {
              throw new Error(\`A1 final-world Tunnel_C contact is not aircraft-side along the bridge: along=\${exactA1TunnelCAlongBridge} ratio=\${exactA1TunnelCAlongRatio} bridge=\${exactA1TunnelCBridgeSpan}\`);
            }
            if (!(exactA1TunnelCLateralOffset < 4.0)) {
              throw new Error(\`A1 final-world Tunnel_C contact is too far off the Rotunda-to-Cab axis: lateral=\${exactA1TunnelCLateralOffset}\`);
            }
            if (!(Math.abs(exactA1TunnelCMinimumY) <= 0.02)) {
              throw new Error(\`A1 final-world Tunnel_C bogie/support is not on the ramp: minY=\${exactA1TunnelCMinimumY}\`);
            }
            exactA1BogieContactX = exactA1TunnelCLowCenter.x;
            exactA1BogieContactY = exactA1TunnelCMinimumY;
            exactA1BogieContactZ = exactA1TunnelCLowCenter.z;
            exactA1BogieContactReady = true;
            exactA1BogieFinalWorldPointCount = exactA1TunnelCLowPointCount;
            exactA1BogieFinalWorldHorizontalSpan = exactA1TunnelCHorizontalSpan;
            exactA1BogieFinalWorldAlongBridgeMeters = exactA1TunnelCAlongBridge;
            exactA1BogieFinalWorldAlongBridgeRatio = exactA1TunnelCAlongRatio;
            exactA1BogieFinalWorldLateralOffsetMeters = exactA1TunnelCLateralOffset;
            exactA1BogieFinalWorldMinimumY = exactA1TunnelCMinimumY;
            exactA1CameraFleet.userData.uploadedJetwayBogieFinalWorldContactAuthority = "${authority}";
            exactA1CameraFleet.userData.uploadedJetwayBogieFinalWorldContactCenterX = exactA1BogieContactX;
            exactA1CameraFleet.userData.uploadedJetwayBogieFinalWorldContactCenterY = exactA1BogieContactY;
            exactA1CameraFleet.userData.uploadedJetwayBogieFinalWorldContactCenterZ = exactA1BogieContactZ;
            exactA1CameraFleet.userData.uploadedJetwayBogieFinalWorldContactPointCount = exactA1BogieFinalWorldPointCount;
            exactA1CameraFleet.userData.uploadedJetwayBogieFinalWorldHorizontalSpanMeters = exactA1BogieFinalWorldHorizontalSpan;
            exactA1CameraFleet.userData.uploadedJetwayBogieFinalWorldAlongBridgeMeters = exactA1BogieFinalWorldAlongBridgeMeters;
            exactA1CameraFleet.userData.uploadedJetwayBogieFinalWorldAlongBridgeRatio = exactA1BogieFinalWorldAlongBridgeRatio;
            exactA1CameraFleet.userData.uploadedJetwayBogieFinalWorldLateralOffsetMeters = exactA1BogieFinalWorldLateralOffsetMeters;
            exactA1CameraFleet.userData.uploadedJetwayBogieFinalWorldMinimumY = exactA1BogieFinalWorldMinimumY;
          } else {
            exactA1BogieContactReady = [
              exactA1BogieContactX,
              exactA1BogieContactY,
              exactA1BogieContactZ,
            ].every(Number.isFinite);
          }`;

  if (!source.includes(oldBlock)) {
    throw new Error(`${trainerPath}: stale pre-parent bogie camera center block is missing`);
  }
  source = source.replace(oldBlock, newBlock);

  const publishAnchor = `            renderer.domElement.dataset.inspectionCameraEndpointBogieContactCenter = [
              exactA1BogieContactX, exactA1BogieContactY, exactA1BogieContactZ,
            ].map((value) => value.toFixed(6)).join(",");`;
  const publishBlock = `${publishAnchor}
            renderer.domElement.dataset.inspectionCameraEndpointBogieFinalWorldAuthority = "${authority}";
            renderer.domElement.dataset.inspectionCameraEndpointBogieFinalWorldPointCount = String(exactA1BogieFinalWorldPointCount);
            renderer.domElement.dataset.inspectionCameraEndpointBogieFinalWorldHorizontalSpanMeters = exactA1BogieFinalWorldHorizontalSpan.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointBogieFinalWorldAlongBridgeMeters = exactA1BogieFinalWorldAlongBridgeMeters.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointBogieFinalWorldAlongBridgeRatio = exactA1BogieFinalWorldAlongBridgeRatio.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointBogieFinalWorldLateralOffsetMeters = exactA1BogieFinalWorldLateralOffsetMeters.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointBogieFinalWorldMinimumY = exactA1BogieFinalWorldMinimumY.toFixed(6);`;
  if (!source.includes(publishAnchor)) {
    throw new Error(`${trainerPath}: bogie contact dataset publish anchor is missing`);
  }
  source = source.replace(publishAnchor, publishBlock);
  source = source.replace(
    'renderer.domElement.dataset.inspectionCameraEndpointBogieProfileAuthority = "a1-tunnel-c-bogie-apron-half-plane-side-profile-v2";',
    'renderer.domElement.dataset.inspectionCameraEndpointBogieProfileAuthority = "a1-final-world-tunnel-c-bogie-apron-half-plane-side-profile-v3";',
  );
}

for (const required of [
  marker,
  authority,
  'getObjectByName?.("UploadedAirportJetway_A1")',
  'getObjectByName?.("UploadedAirportJetwayModel_A1")',
  'getObjectByName?.("Tunnel_C")',
  'exactA1TunnelCAlongRatio > 0.40 && exactA1TunnelCAlongRatio < 0.88',
  'Math.abs(exactA1TunnelCMinimumY) <= 0.02',
  'inspectionCameraEndpointBogieFinalWorldAuthority',
  'a1-final-world-tunnel-c-bogie-apron-half-plane-side-profile-v3',
]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: final-world Tunnel_C bogie evidence is missing ${required}`);
}
for (const forbidden of [
  'const exactA1BogieContactX = Number(',
  'const exactA1BogieContactY = Number(',
  'const exactA1BogieContactZ = Number(',
  'a1-tunnel-c-bogie-apron-half-plane-side-profile-v2',
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: stale pre-parent bogie camera evidence survived: ${forbidden}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared A1 bogie evidence from the final visible Tunnel_C low-contact cluster in scene world space; the camera now targets the actual aircraft-side support truck and fails if it is near the Rotunda or off the ramp.");
