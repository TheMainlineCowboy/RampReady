import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-source-parking-center-v1";

// Decoded KPHX A1 parking is local [0,0] and the Terminal 4 source group is
// world-shifted +6.2 m in Z. Keep the CRJ on that authored stand instead of the
// historical Cab-fitted [-3.822,10.254] pose. The aircraft model's heading
// convention uses the source 270.491-degree parking heading as +0.491 degrees.
const pose = Object.freeze({ x: 0, y: -0.002196, z: 6.2, yaw: 0.008570 });

function replaceConst(source, name, value) {
  const pattern = new RegExp(`const ${name} = [^;]+;`);
  if (!pattern.test(source)) throw new Error(`${trainerPath}: missing ${name}`);
  return source.replace(pattern, `const ${name} = ${value};`);
}

let trainer = fs.readFileSync(trainerPath, "utf8");
trainer = replaceConst(trainer, "A1_INSPECTION_NOSE_GEAR_X", pose.x);
trainer = replaceConst(trainer, "A1_INSPECTION_NOSE_GEAR_Y", pose.y);
trainer = replaceConst(trainer, "A1_INSPECTION_NOSE_GEAR_Z", pose.z);
trainer = replaceConst(trainer, "A1_INSPECTION_AIRCRAFT_YAW", pose.yaw);
if (!trainer.includes(marker)) {
  const yawLine = `const A1_INSPECTION_AIRCRAFT_YAW = ${pose.yaw};`;
  trainer = trainer.replace(yawLine, `${yawLine}\n// ${marker}`);
}
for (const forbidden of ["const A1_INSPECTION_NOSE_GEAR_X = -3.822373;", "const A1_INSPECTION_NOSE_GEAR_Z = 10.25382;", "const A1_INSPECTION_NOSE_GEAR_Z = 10.253820;"]) {
  if (trainer.includes(forbidden)) throw new Error(`${trainerPath}: Cab-fitted aircraft pose survived: ${forbidden}`);
}
fs.writeFileSync(trainerPath, trainer, "utf8");

let doorFit = fs.readFileSync(doorFitPath, "utf8");
const fixedPoseAnchor = /const FIXED_A1_RENDERED_AIRCRAFT_POSE = Object\.freeze\(\{[\s\S]*?\}\);/;
if (!fixedPoseAnchor.test(doorFit)) throw new Error(`${doorFitPath}: final fixed-aircraft pose block is missing`);
doorFit = doorFit.replace(fixedPoseAnchor, `const FIXED_A1_RENDERED_AIRCRAFT_POSE = Object.freeze({\n  x: ${pose.x},\n  y: ${pose.y},\n  z: ${pose.z},\n  yaw: ${pose.yaw},\n});\n// ${marker}`);
for (const forbidden of ["x: -3.822373", "z: 10.253820", "z: 10.25382"]) {
  if (doorFit.includes(forbidden)) throw new Error(`${doorFitPath}: Cab-fitted source target survived: ${forbidden}`);
}
fs.writeFileSync(doorFitPath, doorFit, "utf8");

console.log(`Prepared ${marker}: A1 CRJ nose gear is fixed at the decoded stand center world [${pose.x}, ${pose.y}, ${pose.z}] yaw=${pose.yaw}; the jetway must reach the aircraft, never move it outboard to satisfy Cab contact.`);
