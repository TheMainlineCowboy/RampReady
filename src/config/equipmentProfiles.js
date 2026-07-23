export const DEFAULT_EQUIPMENT_ID = "lektro-88";

export const EQUIPMENT_PROFILES = Object.freeze([
  Object.freeze({
    id: "lektro-88",
    label: "Lektro 88",
    shortLabel: "Lektro",
    manufacturer: "LEKTRO",
    status: "prototype-ready",
    statusLabel: "Prototype ready",
    available: true,
    description: "Active RampReady training equipment using the current Lektro handling, cradle, steering and towing profile while the cleaned scan replaces the temporary geometry.",
    capabilities: Object.freeze(["Nose-gear capture", "Articulated towing", "Operator and chase views"]),
  }),
  Object.freeze({
    id: "standup-tug",
    label: "Stand-up pushback",
    shortLabel: "Stand-up",
    manufacturer: "Uploaded reference model",
    status: "runtime-asset-pending",
    statusLabel: "Asset not loaded",
    available: false,
    description: "The uploaded stand-up source has a normalization contract, but its verified runtime GLB is not committed or connected to the simulator yet.",
    capabilities: Object.freeze(["Source profile recorded", "Normalization tooling ready", "Runtime integration pending"]),
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
