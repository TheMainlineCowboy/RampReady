import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const legacyAircraftModel = fileURLToPath(new URL("./src/components/aircraft/crj700Model.js", import.meta.url));
const runtimeAircraftModel = fileURLToPath(new URL("./src/components/aircraft/crj700RuntimeModel.js", import.meta.url));
const terminal4Trainer = fileURLToPath(new URL("./src/components/RampReadyStandupTrainerTerminal4.jsx", import.meta.url));
const terminal4Visual = fileURLToPath(new URL("./src/environment/authoredTerminal4Visual.js", import.meta.url));
const a1RotundaSource = fileURLToPath(new URL("./src/environment/sourceRegisteredA1RotundaElbowV3.js", import.meta.url));
const finalA1PhotoTelemetryPreparer = fileURLToPath(new URL("./scripts/prepare-a1-final-photo-telemetry-v1.mjs", import.meta.url));

function attachTerminal4BeforeJetwayReadiness() {
  let source = fs.readFileSync(terminal4Visual, "utf8");
  const buildPattern = /(const\s+sourcePlacedJetways\s*=\s*buildSourcePlacedTerminal4Jetways\([^;]+\);\s*\n)/;
  const attachmentPattern = /\n\s*environment\.add\(authored,\s*sourcePlacedJetways\);\s*\n\s*authored\.updateMatrixWorld\(true\);\s*\n\s*sourcePlacedJetways\.updateMatrixWorld\(true\);\s*/g;
  const buildMatch = buildPattern.exec(source);
  const readinessIndex = source.indexOf("await sourcePlacedJetways.userData.uploadedJetwayReady;");
  const attachmentIndex = source.indexOf("environment.add(authored, sourcePlacedJetways);");

  if (!buildMatch) {
    throw new Error("Terminal 4 source no longer constructs sourcePlacedJetways through the expected builder");
  }
  if (readinessIndex < 0) {
    throw new Error("Terminal 4 source no longer awaits uploaded-jetway readiness");
  }

  const buildIndex = buildMatch.index;
  if (attachmentIndex > buildIndex && attachmentIndex < readinessIndex) {
    console.log("Verified authored Terminal 4 and exact jetways are already attached before uploaded-jetway readiness.");
    return;
  }

  source = source.replace(attachmentPattern, "\n");
  const canonicalAttachment = `${buildMatch[1]}  environment.add(authored, sourcePlacedJetways);\n  authored.updateMatrixWorld(true);\n  sourcePlacedJetways.updateMatrixWorld(true);\n`;
  source = source.replace(buildPattern, canonicalAttachment);

  const finalBuildIndex = source.indexOf("buildSourcePlacedTerminal4Jetways");
  const finalAttachmentIndex = source.indexOf("environment.add(authored, sourcePlacedJetways);");
  const finalReadinessIndex = source.indexOf("await sourcePlacedJetways.userData.uploadedJetwayReady;");
  if (!(finalBuildIndex >= 0 && finalAttachmentIndex > finalBuildIndex && finalAttachmentIndex < finalReadinessIndex)) {
    throw new Error("Terminal 4 pre-readiness attachment ordering could not be established");
  }

  fs.writeFileSync(terminal4Visual, source, "utf8");
  console.log("Attached authored Terminal 4 and source-placed jetways before uploaded-jetway readiness/pavement validation.");
}

function alignFinalA1PhotoTelemetryPreparer() {
  let source = fs.readFileSync(finalA1PhotoTelemetryPreparer, "utf8");
  const legacyMinimum = "const MIN_WALL_METERS = 18;";
  const currentMinimum = "const MIN_WALL_METERS = 16;";
  if (source.includes(legacyMinimum)) source = source.replace(legacyMinimum, currentMinimum);
  if (!source.includes(currentMinimum)) {
    throw new Error("Final A1 photo telemetry preparer is missing the 16 m remote-Rotunda lower bound");
  }

  const legacyReadyAnchor = 'const readyAnchor = "          const renderedDoorA1Elbow = enforceRenderedDoorA1Elbow(THREE, group, fleet, placements);";';
  const currentReadyAnchor = 'const readyAnchor = "          const finalVisibleFit = fitUploadedA1JetwayToRenderedCrjDoor(THREE, group, fleet, placements);";';
  if (source.includes(legacyReadyAnchor)) source = source.replace(legacyReadyAnchor, currentReadyAnchor);
  if (!source.includes(currentReadyAnchor)) {
    throw new Error("Final A1 photo telemetry preparer is missing the current rendered-door fit anchor");
  }

  fs.writeFileSync(finalA1PhotoTelemetryPreparer, source, "utf8");
  console.log("Aligned final A1 photo telemetry with the current 16 m rendered-door runtime anchor.");
}

function finalA1PhotoRotundaAuthority() {
  return {
    name: "rampready-final-a1-photo-rotunda-authority",
    apply: "build",
    buildStart() {
      // The uploaded-jetway readiness chain performs world-space pavement and
      // terminal checks. The authored terminal/jetway group must already be a
      // descendant of the live environment when that promise runs. Verify the
      // semantic order after every preparer instead of depending on one exact
      // generated text layout. Every readiness assertion remains unchanged.
      attachTerminal4BeforeJetwayReadiness();

      // a1-final-vite-buildstart-photo-rotunda-authority-v7-semantic-preawait-order
      // Export User Repair Assets performs a second Vite build after the verified
      // production build has restored tracked runtime source to exact HEAD. That
      // one-time export build deliberately injects only a read-only scene handle;
      // it must not attempt to regenerate production A1 geometry from the restored
      // baseline. This exemption is narrowly keyed to that explicit export marker.
      const trainerSource = fs.readFileSync(terminal4Trainer, "utf8");
      const rotundaSource = fs.readFileSync(a1RotundaSource, "utf8");
      const userRepairExportBuild = trainerSource.includes("window.__rampReadyUserRepairExport = { scene, environment, aircraft };");
      const preparedA1PhotoAuthority = rotundaSource.includes("a1-real-photo-remote-rotunda-fixed-corridor-v1");
      if (userRepairExportBuild && !preparedA1PhotoAuthority) {
        console.log("Skipped final production-only A1 Rotunda preparation for the explicit post-restoration user-repair export build; exported scene hook is read-only and geometry source remains exact HEAD.");
        return;
      }

      // Production preparation contains several late BGATE1 facade/wall passes.
      // A pre-Vite verifier can therefore solve A1 against an intermediate wall
      // and then have that wall endpoint republished before Rollup reads the live
      // runtime modules. The final build boundary must therefore regenerate the
      // photo-authoritative remote Rotunda, bind it to the fixed rendered CRJ door,
      // then republish the final endpoints against the current readiness runtime.
      // Terminal 4 and the aircraft remain fixed; Airport_Jetway.glb child
      // geometry/textures remain untouched.
      alignFinalA1PhotoTelemetryPreparer();
      execFileSync(process.execPath, ["scripts/prepare-a1-photo-remote-rotunda-placement-v2.mjs"], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
      execFileSync(process.execPath, ["scripts/prepare-a1-fixed-door-remote-rotunda-v3.mjs"], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
      execFileSync(process.execPath, ["scripts/prepare-a1-final-photo-telemetry-v1.mjs"], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
      execFileSync(process.execPath, ["scripts/prepare-a1-remote-distance-roundoff-tolerance-v1.mjs"], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
    },
  };
}

export default defineConfig({
  plugins: [finalA1PhotoRotundaAuthority(), react()],
  resolve: {
    alias: [
      { find: "@legacy-crj700", replacement: legacyAircraftModel },
      { find: legacyAircraftModel, replacement: runtimeAircraftModel },
    ],
  },
  base: "/RampReady/",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
