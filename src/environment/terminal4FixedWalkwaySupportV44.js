import * as THREE from "three";

const AUTHORITY = "package-native-fixed-walkway-no-procedural-support-v51";

export function installTerminal4FixedWalkwaySupportV44(group) {
  if (!group?.isGroup) throw new Error("Terminal 4 walkway support authority requires the source jetway group");

  const existing = group.getObjectByName("Terminal4_FixedWalkway_PackageAuthority_V51");
  if (existing) return existing;

  const source = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  if (!source || source.count < 1) {
    throw new Error("Terminal 4 package fixed walkways are missing");
  }

  // The supplied KPHX package is the fixed visual authority. Earlier revisions
  // added procedural columns, girders, footings and braces around this mesh;
  // those overlays made the corridor look fabricated and are intentionally gone.
  const authorityMarker = new THREE.Group();
  authorityMarker.name = "Terminal4_FixedWalkway_PackageAuthority_V51";
  authorityMarker.userData.authority = AUTHORITY;
  authorityMarker.userData.sourceGeometryUnmoved = true;
  authorityMarker.userData.sourceTransformCount = source.count;
  authorityMarker.userData.proceduralSupportMeshCount = 0;
  authorityMarker.userData.packageWalkwayIsSoleVisualAuthority = true;
  group.add(authorityMarker);

  group.userData.fixedWalkwaySupportAuthority = AUTHORITY;
  group.userData.fixedWalkwaySupportSourceTransformCount = source.count;
  group.userData.fixedWalkwaySupportDetailCount = 0;
  group.userData.fixedWalkwaySupportSourceGeometryUnmoved = true;
  group.userData.fixedWalkwayPackageVisualAuthority = true;
  group.userData.fixedWalkwayProceduralSupportRemoved = true;
  return authorityMarker;
}
