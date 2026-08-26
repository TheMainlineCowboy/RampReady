import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const legacyAircraftModel = fileURLToPath(new URL("./src/components/aircraft/crj700Model.js", import.meta.url));
const runtimeAircraftModel = fileURLToPath(new URL("./src/components/aircraft/crj700RuntimeModel.js", import.meta.url));

function finalA1PhotoRotundaAuthority() {
  return {
    name: "rampready-final-a1-photo-rotunda-authority",
    apply: "build",
    buildStart() {
      // a1-final-vite-buildstart-photo-rotunda-authority-v2-node-process
      // Production preparation contains several late BGATE1 facade/wall passes.
      // A pre-Vite verifier can therefore solve A1 against an intermediate wall
      // and then have that wall endpoint republished before Rollup reads the live
      // runtime modules. The bfef1c8f browser evidence proved that failure mode:
      // the preparer reported an 18.0 m wall-to-Rotunda solve, while the bundled
      // runtime still measured 24.543422 m and only 10.344991 m Rotunda-to-Cab.
      //
      // Vite buildStart is the last source-preparation boundary before module
      // transformation. Execute the two final source-authority preparers as real
      // Node processes here rather than query-suffixed dynamic imports. Vite's
      // config bundler rewrites non-literal dynamic imports into import-glob
      // lookups, which made the v1 hook fail before any runtime module could be
      // transformed. A child Node process bypasses that analysis completely and
      // guarantees each preparer executes once, in order, against the final wall.
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
