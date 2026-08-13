import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-bgateg1-wall-normal-registration-v1";
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  const candidateAnchor = `          triangleArea: area,
          materialReference,
          underElevatedWalkway: false,`;
  const candidateReplacement = `          triangleArea: area,
          materialReference,
          // ${marker}: retain the actual authored facade plane normal.
          wallNormalX: normal.x,
          wallNormalZ: normal.z,
          underElevatedWalkway: false,`;
  if (!source.includes(candidateAnchor)) {
    throw new Error(`${runtimePath}: structural wall candidate result is missing`);
  }
  source = source.replace(candidateAnchor, candidateReplacement);

  const resolvedAnchor = `    const terminalWallDistance = resolvedTerminalConnection?.distance ?? null;
    const connectorTowardX = resolvedTerminalConnection?.towardX ?? (jetway.g === "A1" ? -ux : terminalPreferredX);
    const connectorTowardZ = resolvedTerminalConnection?.towardZ ?? (jetway.g === "A1" ? -uz : terminalPreferredZ);
    const connectorYaw = Math.atan2(connectorTowardX, connectorTowardZ);`;
  const resolvedReplacement = `    const terminalWallDistance = resolvedTerminalConnection?.distance ?? null;
    // ${marker}
    // A1's final wall was selected from the original BGATE1 facade. Do not
    // reconstruct its attachment direction from the AIR_Jetway01 model pivot:
    // that pivot is not the replacement Rotunda and is not collinear with the
    // main-terminal wall. Use the authored triangle plane normal, oriented toward
    // the authored A1 aircraft/stand, as the apron direction. The terminal leg
    // is the opposite vector. Static gates retain their existing authority.
    let a1WallOutwardX = null;
    let a1WallOutwardZ = null;
    if (jetway.g === "A1") {
      const wallNormalX = Number(resolvedTerminalConnection?.wallNormalX);
      const wallNormalZ = Number(resolvedTerminalConnection?.wallNormalZ);
      const wallPointX = Number(resolvedTerminalConnection?.pointX);
      const wallPointZ = Number(resolvedTerminalConnection?.pointZ);
      const wallNormalLength = Math.hypot(wallNormalX, wallNormalZ);
      if (!(wallNormalLength > 0.25) || ![wallPointX, wallPointZ].every(Number.isFinite)) {
        throw new Error("A1 original BGATE1 facade is missing a usable wall normal/point: " + JSON.stringify(resolvedTerminalConnection));
      }
      a1WallOutwardX = wallNormalX / wallNormalLength;
      a1WallOutwardZ = wallNormalZ / wallNormalLength;
      const wallToTargetX = targetX - wallPointX;
      const wallToTargetZ = targetZ - wallPointZ;
      if (a1WallOutwardX * wallToTargetX + a1WallOutwardZ * wallToTargetZ < 0) {
        a1WallOutwardX *= -1;
        a1WallOutwardZ *= -1;
      }
      const outwardTargetDot = a1WallOutwardX * wallToTargetX + a1WallOutwardZ * wallToTargetZ;
      if (!(outwardTargetDot > 1)) {
        throw new Error("A1 BGATE1 wall normal does not face the authored stand/apron: dot=" + outwardTargetDot);
      }
      resolvedTerminalConnection.wallOutwardX = a1WallOutwardX;
      resolvedTerminalConnection.wallOutwardZ = a1WallOutwardZ;
      resolvedTerminalConnection.wallNormalAuthority = "original-bgateg1-authored-triangle-normal-facing-a1-stand-v1";
    }
    const connectorTowardX = jetway.g === "A1"
      ? -a1WallOutwardX
      : (resolvedTerminalConnection?.towardX ?? terminalPreferredX);
    const connectorTowardZ = jetway.g === "A1"
      ? -a1WallOutwardZ
      : (resolvedTerminalConnection?.towardZ ?? terminalPreferredZ);
    const connectorYaw = Math.atan2(connectorTowardX, connectorTowardZ);`;
  if (!source.includes(resolvedAnchor)) {
    throw new Error(`${runtimePath}: final resolved connector direction block is missing`);
  }
  source = source.replace(resolvedAnchor, resolvedReplacement);

  const pushAnchor = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      // The decoded airport heading owns the physical placement for ALL gates,
      // including animated A1. Aircraft/door fitting happens later by moving the
      // aircraft, never by inventing a separate A1 jetway heading.
      yaw: sourceJetwayYaw,
      targetX,
      targetZ,`;
  const pushReplacement = `    const a1WallPointX = jetway.g === "A1" ? Number(resolvedTerminalConnection?.pointX) : null;
    const a1WallPointZ = jetway.g === "A1" ? Number(resolvedTerminalConnection?.pointZ) : null;
    const a1RegistrationX = jetway.g === "A1"
      ? a1WallPointX - connectorTowardX * terminalWallDistance
      : jetway.x;
    const a1RegistrationZ = jetway.g === "A1"
      ? a1WallPointZ - connectorTowardZ * terminalWallDistance
      : jetway.z;
    const a1RegistrationShiftX = jetway.g === "A1" ? a1RegistrationX - jetway.x : 0;
    const a1RegistrationShiftZ = jetway.g === "A1" ? a1RegistrationZ - jetway.z : 0;
    const a1WallNormalYaw = jetway.g === "A1"
      ? Math.atan2(a1WallOutwardX, a1WallOutwardZ)
      : sourceJetwayYaw;
    if (jetway.g === "A1" && ![a1RegistrationX, a1RegistrationZ, a1WallNormalYaw].every(Number.isFinite)) {
      throw new Error("A1 BGATE1 wall-normal registration frame is not finite");
    }
    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: a1RegistrationX,
      z: a1RegistrationZ,
      // ${marker}: A1 replacement geometry is registered from the actual BGATE1
      // facade plane. The decoded AIR_Jetway01 heading is preserved below as
      // provenance, but it no longer rotates the replacement away from its wall.
      yaw: a1WallNormalYaw,
      targetX: targetX + a1RegistrationShiftX,
      targetZ: targetZ + a1RegistrationShiftZ,`;
  if (!source.includes(pushAnchor)) {
    throw new Error(`${runtimePath}: uploaded placement block is missing`);
  }
  source = source.replace(pushAnchor, pushReplacement);

  const authorityAnchor = `      sourceJetwayYawRadians: sourceJetwayYaw,
      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
  const authorityReplacement = `      sourceJetwayYawRadians: sourceJetwayYaw,
      sourceHeadingAuthority: jetway.g === "A1" ? "a1-bgl-heading-provenance-bgateg1-wall-normal-placement-v1" : "57-static-bgl-jetway-heading-provenance-v3",
      rawSourceJetwayX: jetway.x,
      rawSourceJetwayZ: jetway.z,
      wallPointX: jetway.g === "A1" ? a1WallPointX : null,
      wallPointZ: jetway.g === "A1" ? a1WallPointZ : null,
      wallOutwardX: jetway.g === "A1" ? a1WallOutwardX : null,
      wallOutwardZ: jetway.g === "A1" ? a1WallOutwardZ : null,
      wallNormalAuthority: jetway.g === "A1" ? "original-bgateg1-authored-triangle-normal-facing-a1-stand-v1" : null,`;
  if (!source.includes(authorityAnchor)) {
    throw new Error(`${runtimePath}: source-heading provenance block is missing`);
  }
  source = source.replace(authorityAnchor, authorityReplacement);
}

for (const required of [
  marker,
  "wallNormalX: normal.x",
  'wallNormalAuthority = "original-bgateg1-authored-triangle-normal-facing-a1-stand-v1"',
  "yaw: a1WallNormalYaw",
  "rawSourceJetwayX: jetway.x",
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: missing final A1 wall-normal token ${required}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Prepared A1 from the original BGATE1 wall point and authored wall normal facing the A1 stand; AIR_Jetway01 pivot/heading remain provenance only and the exact supplied GLB stays untouched.");
