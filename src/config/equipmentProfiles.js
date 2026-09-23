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
    trainingAvailable: true,
    inspectionAvailable: true,
    description: "Active RampReady training equipment using the current Lektro handling, cradle, steering and towing profile while the cleaned scan replaces the temporary geometry.",
    capabilities: Object.freeze(["Nose-gear capture", "Articulated towing", "Operator and chase views"]),
  }),
  Object.freeze({
    id: "manager-kubota",
    label: "Manager Kubota RTV",
    shortLabel: "Kubota",
    manufacturer: "Kubota",
    status: "exact-runtime",
    statusLabel: "Exact runtime",
    available: true,
    trainingAvailable: false,
    inspectionAvailable: true,
    description: "Full-fidelity manager/free-drive inspection vehicle restored from the exact user-supplied Kubota GLB. Inspection only; it is not pushback equipment.",
    capabilities: Object.freeze(["Exact 23.99 MB user-supplied model", "Front-wheel steering", "Airport free-drive inspection"]),
  }),
  Object.freeze({
    id: "standup-tug",
    label: "Stand-up pushback",
    shortLabel: "Stand-up",
    manufacturer: "Uploaded reference model",
    status: "verified-runtime",
    statusLabel: "Verified runtime",
    available: true,
    trainingAvailable: true,
    inspectionAvailable: true,
    description: "The exact uploaded stand-up pushback model is normalized, web-optimized, cryptographically verified and connected to the RampReady towing runtime.",
    capabilities: Object.freeze(["Real uploaded model", "Nose-gear pushback training", "Operator and chase views"]),
  }),
]);

export function getEquipmentProfile(id) {
  return EQUIPMENT_PROFILES.find((profile) => profile.id === id) || EQUIPMENT_PROFILES[0];
}

export function getAvailableEquipmentProfiles() {
  return EQUIPMENT_PROFILES.filter((profile) => profile.available);
}

export function isEquipmentLaunchable(id, mode = "training") {
  const profile = EQUIPMENT_PROFILES.find((entry) => entry.id === id);
  if (!profile?.available) return false;
  if (mode === "inspection") return profile.inspectionAvailable !== false;
  return profile.trainingAvailable !== false;
}
