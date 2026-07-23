import assert from "node:assert/strict";
import {
  DEFAULT_EQUIPMENT_ID,
  EQUIPMENT_PROFILES,
  getAvailableEquipmentProfiles,
  getEquipmentProfile,
  isEquipmentLaunchable,
} from "../src/config/equipmentProfiles.js";

assert.equal(DEFAULT_EQUIPMENT_ID, "standup-tug");
assert.equal(EQUIPMENT_PROFILES.length, 2, "stand-up and Lektro entries must both be visible");
assert.deepEqual(EQUIPMENT_PROFILES.map((profile) => profile.id), ["standup-tug", "lektro-88"]);
assert.equal(getEquipmentProfile("missing").id, DEFAULT_EQUIPMENT_ID, "unknown selections must fall back safely");
assert.equal(isEquipmentLaunchable("standup-tug"), true, "verified stand-up trainer must launch");
assert.equal(isEquipmentLaunchable("lektro-88"), false, "Lektro must remain gated until its asset and handling profile pass verification");
assert.deepEqual(getAvailableEquipmentProfiles().map((profile) => profile.id), ["standup-tug"]);

for (const profile of EQUIPMENT_PROFILES) {
  assert.match(profile.id, /^[a-z0-9-]+$/);
  assert.ok(profile.label.length > 4);
  assert.ok(profile.description.length > 20);
  assert.ok(profile.capabilities.length >= 3);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.capabilities), true);
}

console.log("Equipment selection contract verified.");
