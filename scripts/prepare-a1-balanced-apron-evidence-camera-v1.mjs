import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-balanced-apron-side-terminal-joint-camera-v1";
const framingMarker = "a1-terminal-joint-photo-framing-v3-generation-safe";
const cameraAuthority = "source-measured-a1-apron-side-evidence-camera-v5-balanced-branches";
let source = fs.readFileSync(trainerPath, "utf8");

const biasedBlock = `            const exactA1JointBiasedOutX = exactA1JointApronNormalX - exactA1JointWallUnitX * 0.40;
            const exactA1JointBiasedOutZ = exactA1JointApronNormalZ - exactA1JointWallUnitZ * 0.40;
            const exactA1JointBiasedOutLength = Math.hypot(exactA1JointBiasedOutX, exactA1JointBiasedOutZ);
            if (!(exactA1JointBiasedOutLength > 0.5)) {
              throw new Error(\`A1 passenger-joint apron-side camera vector collapsed: \${exactA1JointBiasedOutLength}\`);
            }
            const exactA1JointCameraOutX = exactA1JointBiasedOutX / exactA1JointBiasedOutLength;
            const exactA1JointCameraOutZ = exactA1JointBiasedOutZ / exactA1JointBiasedOutLength;`;

const balancedBlock = `            // ${marker}
            // The signed through-axis normal already selects the apron half-plane.
            // Do not bias it back toward/away from the terminal wall: adding a wall
            // component destroys the equal wall/Tunnel-A side-profile that the
            // through-axis camera mathematically guarantees.
            const exactA1JointCameraOutX = exactA1JointApronNormalX;
            const exactA1JointCameraOutZ = exactA1JointApronNormalZ;`;

let explicitCameraOutBindingsPresent = false;
if (!source.includes(marker)) {
  if (source.includes(biasedBlock)) {
    source = source.replace(biasedBlock, balancedBlock);
    explicitCameraOutBindingsPresent = true;
  } else {
    // Late production preparers can either retain writable camera-out bindings or
    // inline those components into the final camera-position expression. Handle
    // both forms without weakening the actual browser acceptance contract.
    const cameraBindings = [
      ["X", "exactA1JointApronNormalX"],
      ["Z", "exactA1JointApronNormalZ"],
    ];
    const bindingMatches = cameraBindings.map(([axis]) => {
      const name = `exactA1JointCameraOut${axis}`;
      const bindingPattern = new RegExp(`\\b(?:(?:const|let|var)\\s+)?${name}\\s*=\\s*[^;\\n]+;`, "g");
      return [axis, bindingPattern, [...source.matchAll(bindingPattern)]];
    });
    const counts = bindingMatches.map(([, , matches]) => matches.length);

    if (counts.every((count) => count === 1)) {
      let insertedMarker = false;
      for (let index = 0; index < cameraBindings.length; index += 1) {
        const [axis, apronNormal] = cameraBindings[index];
        const [, , matches] = bindingMatches[index];
        const name = `exactA1JointCameraOut${axis}`;
        const original = matches[0][0];
        const declaration = original.match(/^(const|let|var)\s+/)?.[1];
        const normalized = `${declaration ? `${declaration} ` : ""}${name} = ${apronNormal};`;
        const replacement = !insertedMarker
          ? `// ${marker}\n            // Final shipping camera normalized by variable identity after all late preparers.\n            ${normalized}`
          : normalized;
        source = source.slice(0, matches[0].index) + replacement + source.slice(matches[0].index + original.length);
        insertedMarker = true;
      }
      explicitCameraOutBindingsPresent = true;
    } else if (counts.every((count) => count === 0)) {
      // The newest late-generation form has already inlined the camera-out vector.
      // Do not recreate dead bindings. Instead require the strict runtime truths
      // that make the photo evidence fail closed, then anchor the v5 authority at
      // the surviving terminal-joint side-distance declaration.
      for (const requiredInlineGuard of [
        "exactA1JointApronHalfPlaneOffset > 2.5",
        "exactA1JointBranchViewImbalance < 0.20",
      ]) {
        if (!source.includes(requiredInlineGuard)) {
          throw new Error(`${trainerPath}: inlined final A1 camera is missing ${requiredInlineGuard}`);
        }
      }
      const sideDistancePattern = /\bconst exactA1JointSideDistance = [^;\n]+;/g;
      const sideDistanceMatches = [...source.matchAll(sideDistancePattern)];
      if (sideDistanceMatches.length !== 1) {
        throw new Error(`${trainerPath}: inlined final A1 camera has no unique terminal-joint side-distance declaration (${sideDistanceMatches.length})`);
      }
      source = source.slice(0, sideDistanceMatches[0].index)
        + `// ${marker}\n            // Final shipping camera is already inlined; strict apron-half-plane and branch-balance guards remain authoritative.\n            `
        + source.slice(sideDistanceMatches[0].index);
    } else {
      throw new Error(`${trainerPath}: inconsistent final A1 terminal-joint camera bindings X/Z=${counts.join("/")}`);
    }
  }
} else {
  explicitCameraOutBindingsPresent = source.includes("exactA1JointCameraOutX") || source.includes("exactA1JointCameraOutZ");
}

// Bind the terminal-joint branch nearest the normalized camera to the v5 authority.
// Do not replace unrelated bogie/full-assembly subview authorities elsewhere.
const markerIndex = source.indexOf(marker);
if (markerIndex < 0) {
  throw new Error(`${trainerPath}: balanced A1 terminal-joint camera marker was not created`);
}
const authorityPattern = /renderer\.domElement\.dataset\.inspectionCameraEndpointSubviewAuthority = "[^"]+";/g;
const authorityMatches = [...source.matchAll(authorityPattern)].filter(match => match.index > markerIndex);
if (authorityMatches.length < 1) {
  throw new Error(`${trainerPath}: final A1 terminal-joint subview authority assignment is missing after the balanced camera`);
}
const nearestAuthority = authorityMatches[0][0];
source = source.slice(0, authorityMatches[0].index)
  + `renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "${cameraAuthority}";`
  + source.slice(authorityMatches[0].index + nearestAuthority.length);

// Pull only this diagnostic view farther back so the long fixed corridor cannot
// hide the real facade attachment. Geometry and all branch/T4_WALK checks stay put.
if (!source.includes(framingMarker)) {
  const sideDistancePattern = /\bconst exactA1JointSideDistance = [^;\n]+;/g;
  const sideDistanceMatches = [...source.matchAll(sideDistancePattern)];
  if (sideDistanceMatches.length !== 1) {
    throw new Error(`${trainerPath}: expected exactly one A1 terminal-joint side-distance declaration, found ${sideDistanceMatches.length}`);
  }
  source = source.replace(
    sideDistancePattern,
    `// ${framingMarker}\n            const exactA1JointSideDistance = 22;`,
  );

  const fovNeedle = "inspectionCamera.fov = 42;";
  if (source.includes(fovNeedle)) {
    source = source.replace(fovNeedle, "inspectionCamera.fov = 50;");
  }
}

for (const forbidden of [
  "exactA1JointBiasedOutX",
  "exactA1JointBiasedOutZ",
  "exactA1JointBiasedOutLength",
  'inspectionCameraEndpointSubviewAuthority = "source-measured-a1-apron-side-evidence-camera-v4"',
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: stale imbalanced A1 terminal camera logic remains: ${forbidden}`);
}
for (const required of [
  marker,
  framingMarker,
  "const exactA1JointSideDistance = 22;",
  "exactA1JointApronHalfPlaneOffset > 2.5",
  "exactA1JointBranchViewImbalance < 0.20",
  `inspectionCameraEndpointSubviewAuthority = "${cameraAuthority}"`,
]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: balanced apron-side A1 evidence camera is missing ${required}`);
}
if (explicitCameraOutBindingsPresent) {
  for (const required of [
    "exactA1JointCameraOutX = exactA1JointApronNormalX;",
    "exactA1JointCameraOutZ = exactA1JointApronNormalZ;",
  ]) {
    if (!source.includes(required)) throw new Error(`${trainerPath}: explicit balanced A1 camera binding is missing ${required}`);
  }
}

if (!source.includes("T4_WALK")) {
  throw new Error(`${trainerPath}: balanced apron-side A1 evidence camera lost T4_WALK exclusion/probe logic`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${cameraAuthority} + ${framingMarker}: A1 terminal-joint evidence accepts either explicit or generation-inlined final camera vectors only with strict apron-side, branch-balance and T4_WALK checks, and pulls the close view back to 22 m without changing airport or jetway geometry.`);
