export const AUTHORED_KPHX_PHOTO_PROFILE = Object.freeze({
  source: "retired-pre-source-KPHX-PHXPhoto.bgl",
  packageVersion: "superseded-by-KPHX-1.75.1-WED-ground",
  detailLevel: "inactive-on-exact-KPHX-source-airport",
  textureMode: "inactive-obsolete-BGL-aerial",
  maxRuntimeTextureDimension: 0,
});

export async function installAuthoredKphxPhotoGround(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  const exactWedGround = String(environment.userData.groundSource || "").startsWith("exact-kphx-1.75.1-wed");
  if (!exactWedGround) {
    throw new Error("Legacy PHX photo ground is disabled unless the exact KPHX WED ground authority is active");
  }

  // The previous PHXPhoto BGL belonged to the superseded reconstructed-airport
  // pipeline. The exact KPHX 1.75.1 scenery uses its own WED/DSF polygon,
  // orthophoto and library resources. Do not silently reintroduce the old aerial
  // or fabricate a replacement while those exact resources are being ingested.
  const group = new THREE.Group();
  group.name = "KPHX_Exact_Source_PhotoGround_Placeholder_NoVisibleGeometry";
  group.userData = {
    sourceAuthority: "exact-KPHX-1.75.1-WED-DSF",
    visualPolicy: "fail-closed-no-obsolete-BGL-aerial",
    pendingAuthority: "exact-WED-draped-orthophoto-and-source-library-materialization",
  };
  environment.add(group);

  environment.userData.photoGroundSource = "inactive-obsolete-bgl-aerial-exact-kphx-source-active";
  environment.userData.authoredPhotoGround = group;
  environment.userData.authoredPhotoDetailLevel = AUTHORED_KPHX_PHOTO_PROFILE.detailLevel;
  environment.userData.authoredPhotoTextureMode = AUTHORED_KPHX_PHOTO_PROFILE.textureMode;
  environment.userData.authoredPhotoRuntimeTileCount = 0;
  environment.userData.authoredPhotoMaxTextureDimension = 0;
  environment.userData.authoredPhotoTileCount = 0;
  environment.userData.authoredPhotoWidth = 0;
  environment.userData.authoredPhotoHeight = 0;
  environment.userData.authoredPhotoBytes = 0;
  environment.userData.hiddenADEXSurfaceMaterialCount = 0;
  environment.userData.exactA1BlendedProjectedMaterialCount = 0;
  environment.userData.exactA1HiddenProjectedMaterialCount = 0;
  environment.userData.authoredPhotoSourcePolicy = "do-not-resurrect-superseded-PHXPhoto.bgl";
  return group;
}
