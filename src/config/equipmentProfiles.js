export const DEFAULT_EQUIPMENT_ID = "lektro-88";
export const INSPECTION_EQUIPMENT_ID = "manager-kubota";

export const EQUIPMENT_PROFILES = Object.freeze([
  Object.freeze({
    id: "lektro-88",
    label: "LEKTRO 88 sit-down pushback",
    shortLabel: "LEKTRO 88",
    manufacturer: "LEKTRO / Oshkosh AeroTech",
    status: "physics-profile-active",
    statusLabel: "Physics profile active",
    available: true,
    description: "Sit-down towbarless pushback using a LEKTRO 88 / AP8850SDA-class wheelbase, turning radius, empty/loaded speed envelope and cradle lift profile. The higher-detail sit-down visual is the next asset pass.",
    capabilities: Object.freeze(["Nose-gear cradle and strap", "Rear-steer towbarless handling", "Sit-down operator and chase views"]),
  }),
  Object.freeze({
    id: "standup-tug",
    label: "Stand-up pushback",
    shortLabel: "Stand-up",
    manufacturer: "User revised V3 model",
    status: "revised-v3",
    statusLabel: "Revised V3",
    available: true,
    description: "The user-supplied revised V3 stand-up tug is the visual authority, paired with compact LEKTRO AP8360-class speed, wheelbase and turning behavior for the initial physics profile.",
    capabilities: Object.freeze(["User revised V3 model", "Rear-steer pushback training", "Reference-matched standing operator view"]),
  }),
]);

export function getEquipmentProfile(id) {
  return EQUIPMENT_PROFILES.find((profile) => profile.id === id) || EQUIPMENT_PROFILES[0];
}

export function getAvailableEquipmentProfiles() {
  return EQUIPMENT_PROFILES.filter((profile) => profile.available);
}

export function isEquipmentLaunchable(id) {
  return Boolean(EQUIPMENT_PROFILES.find((profile) => profile.id === id)?.available);
}
