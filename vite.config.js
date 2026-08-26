import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const legacyAircraftModel = fileURLToPath(new URL("./src/components/aircraft/crj700Model.js", import.meta.url));
const runtimeAircraftModel = fileURLToPath(new URL("./src/components/aircraft/crj700RuntimeModel.js", import.meta.url));

function finalA1PhotoRotundaAuthority() {
  return {
    name: "rampready-final-a1-photo-rotunda-authority",
    apply: "build",
    async buildStart() {
      // a1-final-vite-buildstart-photo-rotunda-authority-v1
      // Production preparation contains several late BGATE1 facade/wall passes.
      // A pre-Vite verifier can therefore solve A1 against an intermediate wall
      // and then have that wall endpoint republished before Rollup reads the live
      // runtime modules. The bfef1c8f browser evidence proved that failure mode:
      // the preparer reported an 18.0 m wall-to-Rotunda solve, while the bundled
      // runtime still measured 24.543422 m and only 10.344991 m Rotunda-to-Cab.
      //
      // Vite buildStart is the last source-preparation boundary before module
      // transformation. Re-run the Aug. 15 photo-authoritative remote-Rotunda
      // placement here, after every upstream facade/wall preparer has finished,
      // then immediately bind all physical aircraft consumers to the fixed
      // rendered CRJ forward-left door. Terminal 4 and the aircraft remain fixed;
      // Airport_Jetway.glb child geometry/textures remain untouched.
      const stamp = Date.now();
      await import(`./scripts/prepare-a1-photo-remote-rotunda-placement-v2.mjs?vite-final-photo=${stamp}`);
      await import(`./scripts/prepare-a1-fixed-door-remote-rotunda-v3.mjs?vite-final-door=${stamp}`);
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
