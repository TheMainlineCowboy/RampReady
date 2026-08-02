import fs from "node:fs";

const photoPath = "src/environment/authoredKphxPhotoGround.js";
let source = fs.readFileSync(photoPath, "utf8");
const authority = "source-aerial-above-lowered-adex-safety-underlay-v42";

function replaceRequired(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${photoPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

replaceRequired(
  `    underlay.position.copy(node.position);
    underlay.quaternion.copy(node.quaternion);`,
  `    underlay.position.copy(node.position);
    // ${authority}
    // The ADEX-shaped safety mesh previously remained at pavement elevation,
    // wrote depth before the photo tiles and hid the complete source aerial.
    // Lower only this neutral fallback beneath both the -0.018 m source tiles
    // and the -0.052 m full-coverage fallback plane.
    underlay.position.y -= 0.075;
    underlay.quaternion.copy(node.quaternion);`,
  "ADEX underlay elevation",
);

replaceRequired(
  `    underlay.renderOrder = -30;
    underlay.userData.underlayAuthority = AUTHORED_KPHX_PHOTO_PROFILE.underlayMode;`,
  `    underlay.renderOrder = -50;
    underlay.userData.underlayAuthority = AUTHORED_KPHX_PHOTO_PROFILE.underlayMode;
    underlay.userData.underlayDepthAuthority = "${authority}";
    underlay.userData.sourceAerialClearanceMeters = 0.057;`,
  "ADEX underlay depth authority",
);

replaceRequired(
  `  environment.userData.authoredPhotoUnderlayMaterialCount = underlayMaterialCount;`,
  `  environment.userData.authoredPhotoUnderlayMaterialCount = underlayMaterialCount;
  environment.userData.authoredPhotoUnderlayDepthAuthority = "${authority}";
  environment.userData.authoredPhotoSourceAerialClearanceMeters = 0.057;`,
  "photo underlay runtime authority",
);

for (const token of [
  authority,
  "underlay.position.y -= 0.075",
  "underlay.renderOrder = -50",
  "underlay.userData.sourceAerialClearanceMeters = 0.057",
  "environment.userData.authoredPhotoSourceAerialClearanceMeters = 0.057",
]) {
  if (!source.includes(token)) throw new Error(`${photoPath}: missing aerial-underlay depth token ${token}`);
}

fs.writeFileSync(photoPath, source, "utf8");
console.log("Prepared KPHX aerial underlay depth v42: the neutral ADEX safety mesh is lowered below the complete pinned source aerial instead of occluding it at pavement elevation.");
