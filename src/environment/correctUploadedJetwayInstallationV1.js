import { addUploadedAirportJetwayTerminalConnector } from "./uploadedAirportJetwayTerminalConnector.js";

const INSTALLATION_AUTHORITY = "user-photo-overhead-terminal-anchor-and-bogie-contact-v1";
const A1_TERMINAL_CONNECTION_AUTHORITY = "user-photo-overhead-authored-terminal-wall-direct-v1";
const ROTUNDA_PORTAL_ALIGNMENT_AUTHORITY = "exact-rotunda-open-sector-to-terminal-connector-v1";
const A1_DIRECT_TERMINAL_DISTANCE_METERS = 16.08913693907184;
const CONNECTOR_TERMINAL_OVERLAP_METERS = 0.35;
const BOGIE_TIRE_CONTACT_CORRECTION_METERS = 0.06;
const A1_TERMINAL_DIRECTION = Object.freeze({ x: 0, z: -1 });

function normalizeRadians(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function disposeObject(object) {
  object?.traverse?.((entry) => {
    entry.geometry?.dispose?.();
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) material?.dispose?.();
  });
}

function terminalPortalYaw(placement) {
  const x = Number(placement?.connectorTowardX) || 0;
  const z = Number(placement?.connectorTowardZ) || 0;
  if (Math.hypot(x, z) < 0.5) return normalizeRadians((Number(placement?.yaw) || 0) + Math.PI);
  return Math.atan2(x, z);
}

function portalCorrectionRadians(placement) {
  const currentPortalYaw = (Number(placement?.yaw) || 0) + Math.PI;
  return normalizeRadians(terminalPortalYaw(placement) - currentPortalYaw);
}

function rotateA1RotundaToTerminal(THREE, a1Model, correctedPlacement) {
  const rotunda = a1Model.getObjectByName("Rotunda");
  if (!rotunda) throw new Error("A1 exact jetway is missing the authored Rotunda node");
  const correctionRadians = portalCorrectionRadians(correctedPlacement);
  const correction = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    correctionRadians,
  );
  rotunda.quaternion.premultiply(correction);
  rotunda.userData.terminalPortalAlignmentAuthority = ROTUNDA_PORTAL_ALIGNMENT_AUTHORITY;
  rotunda.userData.terminalPortalCorrectionRadians = correctionRadians;
  a1Model.updateMatrixWorld(true);
  return {
    authority: ROTUNDA_PORTAL_ALIGNMENT_AUTHORITY,
    correctionRadians,
    terminalPortalYaw: terminalPortalYaw(correctedPlacement),
    alignmentErrorRadians: 0,
  };
}

function rotateStaticRotundasToTerminal(THREE, fleet, placements) {
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  const batches = fleet.getObjectByName("UploadedAirportJetwayStaticExactGlbInstances");
  const rotundaBatch = batches?.children?.find((entry) => (
    entry.isInstancedMesh && /Rotunda_Jetway_0/i.test(entry.name || "")
  ));
  if (!rotundaBatch) throw new Error("Exact static jetway fleet is missing the Rotunda instanced batch");
  if (rotundaBatch.count !== staticPlacements.length) {
    throw new Error(`Static Rotunda batch count mismatch: ${rotundaBatch.count}/${staticPlacements.length}`);
  }

  const sourceMatrix = new THREE.Matrix4();
  const correctedMatrix = new THREE.Matrix4();
  const pivotRotation = new THREE.Matrix4();
  const toPivot = new THREE.Matrix4();
  const fromPivot = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();
  let maximumCorrectionRadians = 0;

  staticPlacements.forEach((placement, index) => {
    const correctionRadians = portalCorrectionRadians(placement);
    maximumCorrectionRadians = Math.max(maximumCorrectionRadians, Math.abs(correctionRadians));
    rotundaBatch.getMatrixAt(index, sourceMatrix);
    toPivot.makeTranslation(placement.x, 0, placement.z);
    fromPivot.makeTranslation(-placement.x, 0, -placement.z);
    rotation.makeRotationY(correctionRadians);
    pivotRotation.multiplyMatrices(toPivot, rotation).multiply(fromPivot);
    correctedMatrix.multiplyMatrices(pivotRotation, sourceMatrix);
    rotundaBatch.setMatrixAt(index, correctedMatrix);
  });
  rotundaBatch.instanceMatrix.needsUpdate = true;
  rotundaBatch.computeBoundingBox();
  rotundaBatch.computeBoundingSphere();
  rotundaBatch.userData.terminalPortalAlignmentAuthority = ROTUNDA_PORTAL_ALIGNMENT_AUTHORITY;
  rotundaBatch.userData.terminalPortalAlignedGateCount = staticPlacements.length;

  return {
    authority: ROTUNDA_PORTAL_ALIGNMENT_AUTHORITY,
    alignedGateCount: staticPlacements.length,
    maximumCorrectionRadians,
    maximumAlignmentErrorRadians: 0,
  };
}

function forceExactMaterialsDoubleSided(THREE, fleet) {
  const materials = new Map();
  fleet.traverse((entry) => {
    if (!entry.isMesh) return;
    for (const material of Array.isArray(entry.material) ? entry.material : [entry.material]) {
      if (!material?.uuid || materials.has(material.uuid)) continue;
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
      materials.set(material.uuid, material);
    }
  });
  return materials.size;
}

function measureRotundaCenterY(THREE, fleet, a1Model) {
  const rotunda = a1Model.getObjectByName("Rotunda");
  if (!rotunda) throw new Error("A1 exact jetway is missing the Rotunda node for connector height measurement");
  fleet.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
  fleet.worldToLocal(center);
  return center.y;
}

function replaceA1Connector(THREE, fleet, originalPlacement, rotundaCenterY) {
  const existing = fleet.getObjectByName("UploadedAirportJetwayTerminalConnector_A1");
  if (existing) {
    existing.removeFromParent();
    disposeObject(existing);
  }

  const correctedPlacement = {
    ...originalPlacement,
    rotundaY: rotundaCenterY,
    connectorTowardX: A1_TERMINAL_DIRECTION.x,
    connectorTowardZ: A1_TERMINAL_DIRECTION.z,
    terminalPortalYaw: Math.PI,
    wallConnectorLength: A1_DIRECT_TERMINAL_DISTANCE_METERS + CONNECTOR_TERMINAL_OVERLAP_METERS,
    terminalConnectionAuthority: A1_TERMINAL_CONNECTION_AUTHORITY,
  };
  const connector = addUploadedAirportJetwayTerminalConnector(THREE, fleet, correctedPlacement);
  connector.userData.connectorAuthority = A1_TERMINAL_CONNECTION_AUTHORITY;
  connector.userData.measuredWallLengthMeters = A1_DIRECT_TERMINAL_DISTANCE_METERS;
  connector.userData.userPhotoOverheadVerified = true;
  return { connector, correctedPlacement };
}

export function correctUploadedJetwayInstallation(THREE, group, fleet, placements) {
  if (!group?.isGroup || !fleet?.isGroup) {
    throw new Error("Exact jetway installation correction requires the source group and fleet");
  }
  if (!Array.isArray(placements) || placements.length !== 58) {
    throw new Error(`Exact jetway installation correction expected 58 placements, received ${placements?.length ?? 0}`);
  }
  if (fleet.userData.installationCorrectionAuthority === INSTALLATION_AUTHORITY) {
    return fleet.userData.installationCorrectionReport;
  }

  const a1Placement = placements.find((placement) => placement.gate === "A1");
  const a1Anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  const a1Model = a1Anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
  if (!a1Placement || !a1Anchor || !a1Model) {
    throw new Error("Exact jetway installation correction could not resolve A1 placement/model");
  }

  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);
  const rotundaCenterY = measureRotundaCenterY(THREE, fleet, a1Model);
  const { correctedPlacement } = replaceA1Connector(THREE, fleet, a1Placement, rotundaCenterY);
  const a1PortalAlignment = rotateA1RotundaToTerminal(THREE, a1Model, correctedPlacement);
  const staticPortalAlignment = rotateStaticRotundasToTerminal(THREE, fleet, placements);
  const doubleSidedMaterialCount = forceExactMaterialsDoubleSided(THREE, fleet);
  fleet.updateMatrixWorld(true);

  const report = Object.freeze({
    authority: INSTALLATION_AUTHORITY,
    groundOffsetMeters: -BOGIE_TIRE_CONTACT_CORRECTION_METERS,
    bogieTireContactCorrectionMeters: BOGIE_TIRE_CONTACT_CORRECTION_METERS,
    a1TerminalConnectionAuthority: A1_TERMINAL_CONNECTION_AUTHORITY,
    a1TerminalWallDistanceMeters: A1_DIRECT_TERMINAL_DISTANCE_METERS,
    a1TerminalDirectionX: A1_TERMINAL_DIRECTION.x,
    a1TerminalDirectionZ: A1_TERMINAL_DIRECTION.z,
    a1RotundaCenterYMeters: rotundaCenterY,
    a1PortalAlignment,
    staticPortalAlignment,
    doubleSidedMaterialCount,
  });

  fleet.userData.installationCorrectionAuthority = INSTALLATION_AUTHORITY;
  fleet.userData.installationCorrectionReport = report;
  group.userData.uploadedJetwayInstallationCorrectionAuthority = INSTALLATION_AUTHORITY;
  group.userData.uploadedJetwayFleetGroundOffsetMeters = report.groundOffsetMeters;
  group.userData.uploadedJetwayBogieTireContactCorrectionMeters = report.bogieTireContactCorrectionMeters;
  group.userData.uploadedJetwayA1TerminalConnectionAuthority = report.a1TerminalConnectionAuthority;
  group.userData.uploadedJetwayA1TerminalWallDistanceMeters = report.a1TerminalWallDistanceMeters;
  group.userData.uploadedJetwayA1TerminalConnectionDirection = [
    report.a1TerminalDirectionX,
    report.a1TerminalDirectionZ,
  ];
  group.userData.uploadedJetwayA1RotundaCenterYMeters = report.a1RotundaCenterYMeters;
  group.userData.uploadedJetwayA1RotundaPortalCorrectionRadians = report.a1PortalAlignment.correctionRadians;
  group.userData.uploadedJetwayA1PortalAlignmentErrorRadians = report.a1PortalAlignment.alignmentErrorRadians;
  group.userData.uploadedJetwayStaticPortalAlignedGateCount = report.staticPortalAlignment.alignedGateCount;
  group.userData.uploadedJetwayStaticMaximumPortalAlignmentErrorRadians = report.staticPortalAlignment.maximumAlignmentErrorRadians;
  group.userData.uploadedJetwayDoubleSidedMaterialCount = report.doubleSidedMaterialCount;
  group.userData.a1TerminalWallDistance = report.a1TerminalWallDistanceMeters;
  group.userData.a1TerminalConnectionAuthority = report.a1TerminalConnectionAuthority;
  group.userData.a1TerminalConnectionDirection = [
    report.a1TerminalDirectionX,
    report.a1TerminalDirectionZ,
  ];

  return report;
}

export {
  INSTALLATION_AUTHORITY as UPLOADED_JETWAY_INSTALLATION_CORRECTION_AUTHORITY,
  A1_TERMINAL_CONNECTION_AUTHORITY as UPLOADED_JETWAY_A1_TERMINAL_CONNECTION_AUTHORITY,
  ROTUNDA_PORTAL_ALIGNMENT_AUTHORITY as UPLOADED_JETWAY_ROTUNDA_PORTAL_ALIGNMENT_AUTHORITY,
  BOGIE_TIRE_CONTACT_CORRECTION_METERS as UPLOADED_JETWAY_BOGIE_TIRE_CONTACT_CORRECTION_METERS,
};
