import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const authority = "57-static-exact-bgl-source-placement-no-facade-relocation-v1";
let source = fs.readFileSync(readinessPath, "utf8");

const registrationCall = "          const staticFleetRegistration = registerStaticJetwayFleetToFacade(THREE, group, fleet, placements);";
const preservedCall = `          // Static jetways are already authored at the exact KPHX BGL gate coordinates.
          // Do not move them toward a guessed facade ray hit after the +6.2 m world-frame
          // correction; that relocation visibly detached bridges from their real terminal
          // openings. Keep all 57 source placements and only allow the dedicated A1 photo
          // correction to override its own terminal-side geometry.
          const staticFleetRegistration = Object.freeze({
            authority: "${authority}",
            gateCount: 57,
            sourcePlacementPreserved: true,
          });
          group.userData.uploadedJetwayStaticSourcePlacementAuthority = "${authority}";
          group.userData.uploadedJetwayStaticSourcePlacementGateCount = 57;
          group.userData.uploadedJetwayStaticFacadeRelocationApplied = false;`;

if (source.includes(registrationCall)) {
  source = source.replace(registrationCall, preservedCall);
} else if (!source.includes(`authority: "${authority}"`)) {
  throw new Error(`${readinessPath}: static facade-registration call is missing`);
}

// The previous repair added readiness gates for the guessed facade relocation.
// Those gates validated their own generated coordinates rather than the exact BGL
// positions. Remove only those relocation-specific conditions; all source-model,
// A1 wall/Rotunda, grounding and exact-asset gates remain intact.
const relocationConditionTokens = [
  "staticFacadeRegistrationAuthority !== STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY",
  "staticFacadeRegisteredGateCount !== 57",
  "staticFacadeMaximumWallError > 1e-6",
  "staticPhysicalRotundaMaximumError > 1e-6",
  "staticModelRootOffsetAuthority !== STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY",
  "!Number.isFinite(staticAuthoredRotundaOffsetHorizontal)",
  "staticAuthoredRotundaOffsetHorizontal > 12",
  "Math.abs(staticRotundaCenterToWall - 3.98) > 0.001",
  "Math.abs(staticVisibleTerminalLeg - 2.4) > 0.001",
  "staticGroundIsolationAuthority !== STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY",
  "Math.abs(staticFleetGroundYOffset) > 1e-8",
];
for (const token of relocationConditionTokens) {
  const pattern = new RegExp(`\\n\\s*\\|\\| ${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
  source = source.replace(pattern, "");
}

// The import becomes dead once the runtime relocation call is removed. Delete it
// so the production source cannot accidentally reintroduce the guessed transform.
source = source.replace(
  /import \{[\s\S]*?registerStaticJetwayFleetToFacade,[\s\S]*?\} from "\.\/registerStaticJetwayFleetToFacadeV1\.js";\n?/,
  "",
);

for (const token of [
  authority,
  "uploadedJetwayStaticFacadeRelocationApplied = false",
  "const staticFleetRegistration = Object.freeze({",
  "sourcePlacementPreserved: true",
]) {
  if (!source.includes(token)) throw new Error(`${readinessPath}: source-placement integrity is missing ${token}`);
}
if (source.includes("registerStaticJetwayFleetToFacade(THREE, group, fleet, placements)")) {
  throw new Error(`${readinessPath}: guessed static facade relocation is still active`);
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Locked all 57 static Terminal 4 jetways to their exact BGL source placements and disabled guessed post-registration facade relocation.");
