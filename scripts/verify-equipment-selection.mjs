import assert from "node:assert/strict";
import {
  DEFAULT_EQUIPMENT_ID,
  EQUIPMENT_PROFILES,
  getAvailableEquipmentProfiles,
  getEquipmentProfile,
  isEquipmentLaunchable,
} from "../src/config/equipmentProfiles.js";

assert.equal(DEFAULT_EQUIPMENT_ID, "lektro-88");
assert.equal(EQUIPMENT_PROFILES.length, 2, "Lektro and stand-up entries must both be visible");
assert.deepEqual(EQUIPMENT_PROFILES.map((profile) => profile.id), ["lektro-88", "standup-tug"]);
assert.equal(getEquipmentProfile("missing").id, DEFAULT_EQUIPMENT_ID, "unknown selections must fall back safely");
assert.equal(isEquipmentLaunchable("lektro-88"), true, "the active Lektro training profile must launch");
assert.equal(isEquipmentLaunchable("standup-tug"), false, "stand-up must remain gated until its runtime GLB is committed and connected");
assert.deepEqual(getAvailableEquipmentProfiles().map((profile) => profile.id), ["lektro-88"]);

for (const profile of EQUIPMENT_PROFILES) {
  assert.match(profile.id, /^[a-z0-9-]+$/);
  assert.ok(profile.label.length > 4);
  assert.ok(profile.statusLabel.length > 4);
  assert.ok(profile.description.length > 20);
  assert.ok(profile.capabilities.length >= 3);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.capabilities), true);
}

console.log("Equipment selection contract verified: Lektro is the truthful active profile and stand-up remains gated until its runtime asset exists.");
