import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");
const authority = "live-threejs-render-then-encode-evidence-v1";

if (!source.includes(authority)) {
  const anchor = "    simRef.current = sim;";
  if (!source.includes(anchor)) {
    throw new Error("Terminal 4 trainer is missing the live simulator assignment required for rendered evidence capture.");
  }

  const hook = `${anchor}\n\n    // ${authority}\n    // Browser evidence must not read a preserveDrawingBuffer=false WebGL canvas\n    // after Chromium has composited and discarded its backbuffer. Force the\n    // CURRENT live scene/camera through the real renderer and encode the PNG\n    // synchronously in the same JavaScript turn. This changes no geometry,\n    // camera pose or readiness state.\n    window.__rampReadyCaptureEvidencePng = () => {\n      scene.updateMatrixWorld(true);\n      camera.updateMatrixWorld(true);\n      renderer.render(scene, camera);\n      renderer.getContext()?.finish?.();\n      const encoded = renderer.domElement.toDataURL(\"image/png\");\n      if (!encoded || !encoded.startsWith(\"data:image/png;base64,\")) {\n        throw new Error(\"Live Three.js renderer did not return PNG evidence\");\n      }\n      renderer.domElement.dataset.evidenceCaptureAuthority = \"${authority}\";\n      return encoded;\n    };`;

  source = source.replace(anchor, hook);
  fs.writeFileSync(trainerPath, source, "utf8");
}

for (const required of [
  authority,
  "window.__rampReadyCaptureEvidencePng",
  "renderer.render(scene, camera)",
  "renderer.domElement.toDataURL(\"image/png\")",
]) {
  if (!source.includes(required)) throw new Error(`Rendered-canvas evidence hook is missing ${required}`);
}

console.log("Installed live Three.js render-then-encode evidence hook immediately after simulator construction; geometry and camera state are unchanged.");
