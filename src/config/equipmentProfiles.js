export const DEFAULT_EQUIPMENT_ID = "standup-tug";

export const EQUIPMENT_PROFILES = Object.freeze([
  Object.freeze({
    id: "standup-tug",
    label: "Stand-up pushback",
    shortLabel: "Stand-up",
    manufacturer: "RampReady training rig",
    status: "ready",
    available: true,
    description: "Primary PHX training equipment with the active cradle, steering, operator and towing rig.",
    capabilities: Object.freeze(["Nose-gear capture", "Articulated towing", "Operator view"]),
  }),
  Object.freeze({
    id: "lektro-88",
    label: "Lektro 88",
    shortLabel: "Lektro",
    manufacturer: "LEKTRO",
    status: "asset-pending",
    available: false,
    description: "Reserved for the cleaned Lektro scan and its equipment-specific geometry, controls and towing limits.",
    capabilities: Object.freeze(["Model intake recorded", "Runtime profile reserved", "Visual cleanup pending"]),
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
