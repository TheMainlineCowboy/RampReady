import * as THREE from "three";

const DISABLED_AUTHORITY = "legacy-a1-walkway-portal-disabled-real-terminal-wall-v38";
const LEGACY_OBJECT_NAME = "A1_T4_WALK_TerminalPortalSeal_V37";

function removeLegacyPortalGeometry(jetwayGroup) {
  const legacy = jetwayGroup.getObjectByName(LEGACY_OBJECT_NAME);
  if (!legacy) return 0;

  legacy.traverse((entry) => {
    if (!entry?.isMesh) return;
    entry.geometry?.dispose?.();
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) material?.dispose?.();
  });
  legacy.removeFromParent();
  return 1;
}

export function installA1TerminalPortalSealV37(jetwayGroup) {
  if (!jetwayGroup?.isGroup) {
    throw new Error("A1 legacy portal disablement requires the Terminal 4 jetway group");
  }

  // Do not manufacture any A1 geometry at the historical elevated-walkway
  // portal. Gate A1 is attached by the complete uploaded jetway parent to the
  // measured ramp-level Terminal 4 structural facade. Keeping a second shell,
  // doorway, frame, threshold or dark interior at the old walkway coordinates
  // creates a false visual connection even when the actual jetway transform is
  // correct.
  const removedLegacyPortalCount = removeLegacyPortalGeometry(jetwayGroup);

  const disabled = new THREE.Group();
  disabled.name = "A1_LegacyWalkwayPortalDisabled_V38";
  disabled.userData.authority = DISABLED_AUTHORITY;
  disabled.userData.portalOverlapMeters = 0;
  disabled.userData.usesExactRecoveredJetwayTexture = false;
  disabled.userData.disabled = true;
  disabled.userData.removedLegacyPortalCount = removedLegacyPortalCount;

  // Preserve compatibility telemetry for existing consumers without adding the
  // disabled marker to the rendered scene.
  jetwayGroup.userData.a1TerminalPortalSealAuthority = DISABLED_AUTHORITY;
  jetwayGroup.userData.a1TerminalPortalSealOverlapMeters = 0;
  jetwayGroup.userData.a1TerminalPortalSealExactTexture = false;
  jetwayGroup.userData.a1TerminalPortalSealTextureIdentity = "disabled";
  jetwayGroup.userData.a1TerminalPortalSealHollow = false;
  jetwayGroup.userData.a1TerminalPortalSealDisabled = true;
  jetwayGroup.userData.a1TerminalPortalSealRemovedLegacyCount = removedLegacyPortalCount;

  return disabled;
}
