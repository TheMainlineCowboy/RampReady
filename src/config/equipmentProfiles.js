export const DEFAULT_EQUIPMENT_ID = "lektro-88";
export const INSPECTION_EQUIPMENT_ID = "manager-kubota";

export const EQUIPMENT_PROFILES = Object.freeze([
  Object.freeze({
    id: "lektro-88",
    label: "LEKTRO 88 sit-down pushback",
    shortLabel: "LEKTRO 88",
    manufacturer: "LEKTRO / Oshkosh AeroTech",
    status: "detailed-runtime",
    statusLabel: "Detailed runtime",
    available: true,
    description: "Detailed sit-down towbarless LEKTRO 88 / AP8850SDA-class model with dual rear steering, fixed front drive wheels, cradle, horizontal winch, strap, three-roller stack, dual seats and operator controls.",
    capabilities: Object.freeze(["Nose-gear cradle and strap", "Dual rear steer wheels near 90 degrees", "Sit-down operator and chase views"]),
  }),
  Object.freeze({
    id: "standup-tug",
    label: "Stand-up pushback",
    shortLabel: "Stand-up",
    manufacturer: "User revised V3 model",
    status: "verified-runtime",
    statusLabel: "Revised V3 runtime",
    available: true,
    description: "The user-supplied revised V3 stand-up tug is the visual authority, using a single center rear steering wheel with near-90-degree articulation and the reference standing driver camera.",
    capabilities: Object.freeze(["User revised V3 model", "Single center rear steering", "Reference-matched standing operator view"]),
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
