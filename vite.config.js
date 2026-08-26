import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const legacyAircraftModel = fileURLToPath(new URL("./src/components/aircraft/crj700Model.js", import.meta.url));
const runtimeAircraftModel = fileURLToPath(new URL("./src/components/aircraft/crj700RuntimeModel.js", import.meta.url));
const terminal4Trainer = fileURLToPath(new URL("./src/components/RampReadyStandupTrainerTerminal4.jsx", import.meta.url));
const a1RotundaSource = fileURLToPath(new URL("./src/environment/sourceRegisteredA1RotundaElbowV3.js", import.meta.url));

function finalA1PhotoRotundaAuthority() {
  return {
    name: "rampready-final-a1-photo-rotunda-authority",
    apply: "build",
    buildStart() {
      // a1-final-vite-buildstart-photo-rotunda-authority-v5-export-safe-roundoff
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
      // runtime modules. The bfef1c8f browser evidence proved that failure mode:
      // the preparer reported an 18.0 m wall-to-Rotunda solve, while the bundled
      // runtime still measured 24.543422 m and only 10.344991 m Rotunda-to-Cab.
      //
      // Vite buildStart is the last source-preparation boundary before module
      // transformation. Execute the final source-authority preparers as real Node
      // processes here rather than query-suffixed dynamic imports. Vite's config
      // bundler rewrites non-literal dynamic imports into import-glob lookups, so
      // child Node processes guarantee each pass executes once, in order, against
      // the final wall. The endpoint republisher must run after the 18 m fixed-door
      // solve; otherwise the final solve can regenerate the old userData endpoint
      // read and the browser aborts before evidence with "wall/aircraft endpoints
      // are missing" even though the explicit BGATE1 wall was already resolved.
      // The final tolerance pass changes no pose: it only treats sub-millimetric
      // IEEE-754 underflow around the intentional exact 18.000 m lower bound as
      // equal to 18 m in all three final runtime guards.
      //
      // Terminal 4 and the aircraft remain fixed; Airport_Jetway.glb child
      // geometry/textures remain untouched.
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
