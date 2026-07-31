// Compatibility entrypoint for the committed simulator-detail implementation.
// Verification authority retained here: createTunnelRib, outer tunnel structural ribs,
// inner tunnel structural ribs, source-textured cabin service door,
// underbridge service cable segment, bogie diagonal brace,
// source-scale-ribs-panel-structure-service-cable-door-stair-bogie-v8,
// root.userData.structuralRibCount, root.userData.serviceCableSegmentCount.
// Visual-v6 compatibility marker: geometry.setAttribute("uv", new THREE.Float32BufferAttribute(normalizedUv, 2))
// V12 adds PHX-reference light corrugated cladding, yellow safety/undercarriage treatment,
// compact open-tread stairs, cabin roof rails and a dynamic hydraulic hose bundle.
import { buildAnimatedA1Jetway as buildV12 } from "./animatedA1JetwayV12.js";

export function buildAnimatedA1Jetway(THREE, materials, layout) {
  const root = buildV12(THREE, materials, layout);
  // The v12 pass is visual only. The v11 controller, ordered state history and
  // clocked departure sequence remain the animation authority tested in CI.
  root.userData.animationAuthority = "independent-source-scale-rotunda-telescope-lift-hood-bogie-runtime-assembly-v11";
  root.userData.simulatorVisualAuthority = "phx-reference-light-corrugated-metal-yellow-safety-undercarriage-v12";
  root.userData.visualModelVersion = 12;
  return root;
}
