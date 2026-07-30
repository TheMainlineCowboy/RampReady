import fs from "node:fs";

function insertAfter(path, anchor, addition, marker, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(anchor)) throw new Error(`${path}: missing ${label} anchor`);
  source = source.replace(anchor, `${anchor}\n${addition}`);
  fs.writeFileSync(path, source, "utf8");
}

function replaceRequired(path, anchor, replacement, marker, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(anchor)) throw new Error(`${path}: missing ${label} anchor`);
  source = source.replace(anchor, replacement);
  fs.writeFileSync(path, source, "utf8");
}

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
insertAfter(
  jetwayPath,
  'import concourseB from "./kphxV181/concourseB.js";',
  'import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js";',
  "buildAnimatedA1Jetway",
  "animated A1 import",
);
insertAfter(
  jetwayPath,
  "  let terminal4OpenServiceBayCount = 0;",
  "  let a1AnimatedLayout = null;",
  "let a1AnimatedLayout = null",
  "A1 layout state",
);
insertAfter(
  jetwayPath,
  "    transforms.supportFeet.push({ position: [jetway.x, 0.16, jetway.z], yaw, scale: [1.3, 0.22, 1.3] });",
  `
    if (jetway.g === "A1") {
      a1AnimatedLayout = {
        x: jetway.x,
        z: jetway.z,
        yaw,
        bridgeStart,
        bridgeEnd,
        rotundaY,
        cabinY,
      };
      continue;
    }`,
  "a1AnimatedLayout = {",
  "A1 moving-assembly extraction",
);
insertAfter(
  jetwayPath,
  "  const marker = new THREE.SphereGeometry(1, 10, 7);",
  `
  if (!a1AnimatedLayout) throw new Error("Gate A1 animated jetway layout was not decoded");
  const animatedA1Jetway = buildAnimatedA1Jetway(THREE, materials, a1AnimatedLayout);
  group.add(animatedA1Jetway);`,
  "const animatedA1Jetway = buildAnimatedA1Jetway",
  "animated A1 construction",
);
insertAfter(
  jetwayPath,
  "  group.userData.requiresOriginalSourceMesh = true;",
  `  group.userData.a1JetwayController = animatedA1Jetway.userData.controller;
  group.userData.a1JetwayAnimationAuthority = animatedA1Jetway.userData.animationAuthority;
  group.userData.a1JetwayRuntimeState = animatedA1Jetway.userData.state;`,
  "group.userData.a1JetwayController",
  "animated A1 runtime evidence",
);

const terminalPath = "src/environment/authoredTerminal4Visual.js";
insertAfter(
  terminalPath,
  "  environment.userData.authoredTerminal4Jetways = sourcePlacedJetways;",
  `  environment.userData.authoredTerminal4A1JetwayController = sourcePlacedJetways.userData.a1JetwayController;
  environment.userData.authoredTerminal4A1JetwayAnimationAuthority = sourcePlacedJetways.userData.a1JetwayAnimationAuthority;`,
  "authoredTerminal4A1JetwayController",
  "Terminal 4 A1 jetway controller propagation",
);

const runtimePath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
insertAfter(
  runtimePath,
  "  const inspectionRef = useRef(false);",
  `  const jetwayRef = useRef({
    controller: null,
    deployment: 1,
    target: 1,
    retractionRequested: false,
  });`,
  "const jetwayRef = useRef",
  "jetway animation state",
);
insertAfter(
  runtimePath,
  "    sim.aircraft.rotation.y = 0;",
  `    const resetJetwayDeployment = inspectionRef.current ? 0 : 1;
    jetwayRef.current.target = resetJetwayDeployment;
    jetwayRef.current.deployment = resetJetwayDeployment;
    jetwayRef.current.retractionRequested = false;
    jetwayRef.current.controller?.setDeployment(resetJetwayDeployment);`,
  "const resetJetwayDeployment = inspectionRef.current ? 0 : 1",
  "jetway reset",
);
insertAfter(
  runtimePath,
  "      sim.renderer.domElement.dataset.inspectionMode = next ? \"active\" : \"training\";",
  `      const inspectionJetwayDeployment = next ? 0 : 1;
      jetwayRef.current.target = inspectionJetwayDeployment;
      jetwayRef.current.deployment = inspectionJetwayDeployment;
      jetwayRef.current.retractionRequested = false;
      jetwayRef.current.controller?.setDeployment(inspectionJetwayDeployment);`,
  "const inspectionJetwayDeployment = next ? 0 : 1",
  "inspection jetway state",
);
replaceRequired(
  runtimePath,
  `    if (stageRef.current === 0) {
      stageRef.current = 1;
      setStage(1);
      setMessage("Approach directly from the front and stop inside the capture envelope.");`,
  `    if (stageRef.current === 0) {
      if (jetwayRef.current.retractionRequested) return;
      jetwayRef.current.target = 0;
      jetwayRef.current.retractionRequested = true;
      setMessage("Jetway departure sequence active: hood clear, telescope in, then rotate to park before tug approach.");`,
  "Jetway departure sequence active",
  "stage-zero jetway retraction",
);
insertAfter(
  runtimePath,
  '    renderer.domElement.dataset.terminal4JetwayPrePushSequence = "loading";',
  `    renderer.domElement.dataset.a1JetwayDeployment = "loading";
    renderer.domElement.dataset.a1JetwayState = "loading";
    renderer.domElement.dataset.a1JetwayAnimationAuthority = "loading";`,
  'dataset.a1JetwayDeployment = "loading"',
  "jetway dataset initialization",
);
insertAfter(
  runtimePath,
  '        renderer.domElement.dataset.terminal4JetwayPrePushSequence = environment.userData.authoredTerminal4JetwayRequiredPrePushSequence || "missing";',
  `        const a1JetwayController = environment.userData.authoredTerminal4A1JetwayController || null;
        jetwayRef.current.controller = a1JetwayController;
        a1JetwayController?.setDeployment(jetwayRef.current.target);
        renderer.domElement.dataset.a1JetwayDeployment = jetwayRef.current.deployment.toFixed(3);
        renderer.domElement.dataset.a1JetwayState = a1JetwayController?.getState?.() || "missing";
        renderer.domElement.dataset.a1JetwayAnimationAuthority = environment.userData.authoredTerminal4A1JetwayAnimationAuthority || "missing";`,
  "const a1JetwayController = environment.userData.authoredTerminal4A1JetwayController",
  "jetway controller installation",
);
insertAfter(
  runtimePath,
  '        renderer.domElement.dataset.terminal4JetwayPrePushSequence = "load-error";',
  `        renderer.domElement.dataset.a1JetwayDeployment = "load-error";
        renderer.domElement.dataset.a1JetwayState = "load-error";
        renderer.domElement.dataset.a1JetwayAnimationAuthority = "load-error";`,
  'dataset.a1JetwayDeployment = "load-error"',
  "jetway dataset failure state",
);
insertAfter(
  runtimePath,
  "      const inspectionActive = inspectionRef.current;",
  `      const jetway = jetwayRef.current;
      if (jetway.controller) {
        const difference = jetway.target - jetway.deployment;
        if (Math.abs(difference) > 0.0005) {
          const step = Math.min(Math.abs(difference), dt * 0.34);
          jetway.deployment += Math.sign(difference) * step;
          jetway.controller.setDeployment(jetway.deployment);
        }
        renderer.domElement.dataset.a1JetwayDeployment = jetway.deployment.toFixed(3);
        renderer.domElement.dataset.a1JetwayState = jetway.controller.getState?.() || "unknown";
        if (!inspectionActive && jetway.retractionRequested && jetway.deployment <= 0.005 && stageRef.current === 0) {
          jetway.retractionRequested = false;
          stageRef.current = 1;
          setStage(1);
          setMessage("Jetway parked clear. Approach directly from the front and stop inside the capture envelope.");
        }
      }`,
  "const jetway = jetwayRef.current",
  "per-frame jetway animation",
);

for (const [path, tokens] of [
  [jetwayPath, [
    "buildAnimatedA1Jetway",
    "a1AnimatedLayout = {",
    "const animatedA1Jetway = buildAnimatedA1Jetway",
    "group.userData.a1JetwayController",
  ]],
  [terminalPath, [
    "authoredTerminal4A1JetwayController",
    "authoredTerminal4A1JetwayAnimationAuthority",
  ]],
  [runtimePath, [
    "const jetwayRef = useRef",
    "Jetway departure sequence active",
    "const a1JetwayController = environment.userData.authoredTerminal4A1JetwayController",
    "const jetway = jetwayRef.current",
    "dataset.a1JetwayDeployment",
  ]],
]) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${path}: animated A1 departure runtime is missing ${token}`);
}

console.log("Prepared animated Gate A1 departure jetway: attached initial state, hood clearance, telescoping retraction, lift/bogie movement and rotation to park before tug approach.");
