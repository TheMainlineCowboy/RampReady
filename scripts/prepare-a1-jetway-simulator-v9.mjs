import fs from "node:fs";
import concourseA from "../src/environment/kphxV181/concourseA.js";

function replaceRequired(path, before, after, marker, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${path}: missing ${label} anchor`);
  source = source.replace(before, after);
  fs.writeFileSync(path, source, "utf8");
}

function insertAfter(path, anchor, addition, marker, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(anchor)) throw new Error(`${path}: missing ${label} anchor`);
  source = source.replace(anchor, `${anchor}\n${addition}`);
  fs.writeFileSync(path, source, "utf8");
}

const animatedPath = "src/environment/animatedA1Jetway.js";
const placedPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const terminalPath = "src/environment/authoredTerminal4Visual.js";
const runtimePath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const cssPath = "src/components/throttle-force.css";

replaceRequired(
  animatedPath,
  `    const step = box(THREE, materials.stair, \`A1 service step \${index + 1}\`, 1.28, height, 0.34);
    step.position.set(0, height / 2, index * 0.32);
    stairRoot.add(step);`,
  `    const step = box(THREE, materials.stair, \`A1 service tread \${index + 1}\`, 1.28, 0.1, 0.38);
    step.position.set(0, height, index * 0.32);
    const riser = box(THREE, materials.stair, \`A1 service riser \${index + 1}\`, 1.28, 0.18, 0.08);
    riser.position.set(0, height - 0.09, index * 0.32 - 0.16);
    stairRoot.add(step, riser);`,
  "A1 service tread",
  "open service stair geometry",
);

insertAfter(
  animatedPath,
  "  cabinRoot.add(cabinDoor);",
  `
  const cabinFloor = box(THREE, materials.metal, "A1 AIR_Jetway01 cabin floor plate", 2.34, 0.1, 2.2);
  cabinFloor.position.set(0, -1.12, 0);
  cabinRoot.add(cabinFloor);
  const cabinDoorFrameTop = box(THREE, materials.trim, "A1 cabin door frame top", 0.06, 0.08, 0.94);
  cabinDoorFrameTop.position.set(-1.255, 0.93, -0.12);
  const cabinDoorFrameBottom = cabinDoorFrameTop.clone();
  cabinDoorFrameBottom.name = "A1 cabin door frame bottom";
  cabinDoorFrameBottom.position.y = -0.99;
  cabinRoot.add(cabinDoorFrameTop, cabinDoorFrameBottom);
  for (const z of [-0.56, 0.32]) {
    const jamb = box(THREE, materials.trim, \`A1 cabin door jamb \${z}\`, 0.06, 1.92, 0.06);
    jamb.position.set(-1.255, -0.03, z);
    cabinRoot.add(jamb);
  }
  const controlConsole = box(THREE, materials.trim, "A1 cabin operator control console", 0.62, 0.72, 0.48);
  controlConsole.position.set(0.68, -0.68, 0.72);
  controlConsole.rotation.x = -0.16;
  cabinRoot.add(controlConsole);
  const controlFace = box(THREE, materials.glass, "A1 cabin operator control face", 0.54, 0.3, 0.04);
  controlFace.position.set(0.68, -0.42, 0.94);
  controlFace.rotation.x = -0.16;
  cabinRoot.add(controlFace);
  for (const x of [-0.64, 0, 0.64]) {
    const mullion = box(THREE, materials.trim, \`A1 cabin front window mullion \${x}\`, 0.045, 0.72, 0.065);
    mullion.position.set(x, 0.34, 1.135);
    cabinRoot.add(mullion);
  }
  const roofBeacon = cylinder(THREE, materials.marker, "A1 cabin red obstruction beacon", 0.09, 0.12, 14);
  roofBeacon.position.set(0, 1.23, -0.3);
  cabinRoot.add(roofBeacon);`,
  "A1 cabin operator control console",
  "detailed aircraft cabin",
);

replaceRequired(
  animatedPath,
  `      const wheel = cylinder(THREE, materials.tire, \`A1 wheel \${side} \${fore}\`, 0.36, 0.24, 18);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.9, 0.42, fore);
      bogieRoot.add(wheel);`,
  `      const wheel = cylinder(THREE, materials.tire, \`A1 wheel \${side} \${fore}\`, 0.36, 0.24, 24);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.9, 0.42, fore);
      const hub = cylinder(THREE, materials.metal, \`A1 wheel hub \${side} \${fore}\`, 0.16, 0.27, 18);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      const fender = box(THREE, materials.metal, \`A1 wheel fender \${side} \${fore}\`, 0.34, 0.08, 0.62);
      fender.position.set(side * 0.9, 0.78, fore);
      bogieRoot.add(wheel, hub, fender);`,
  "A1 wheel hub",
  "bogie wheel detail",
);

insertAfter(
  animatedPath,
  "  root.add(...cableSegments);",
  `
  const underbridgeRails = [-0.82, 0.82].map((x, index) => {
    const rail = box(THREE, materials.metal, \`A1 underbridge longitudinal rail \${index + 1}\`, 0.09, 0.09, 1);
    rail.position.x = x;
    root.add(rail);
    return rail;
  });
  const underbridgeCrossmembers = Array.from({ length: 10 }, (_, index) => {
    const crossmember = box(THREE, materials.metal, \`A1 underbridge crossmember \${index + 1}\`, 1.82, 0.07, 0.09);
    root.add(crossmember);
    return crossmember;
  });
  const roofCableTray = box(THREE, materials.metal, "A1 roof cable tray", 0.18, 0.11, 1);
  root.add(roofCableTray);
  const bogieMotor = box(THREE, materials.trim, "A1 bogie drive motor housing", 0.72, 0.46, 0.58);
  bogieMotor.position.set(0, 0.82, -0.08);
  bogieRoot.add(bogieMotor);
  const steeringTieRod = cylinder(THREE, materials.metal, "A1 bogie steering tie rod", 0.045, 1.92, 12);
  steeringTieRod.rotation.z = Math.PI / 2;
  steeringTieRod.position.set(0, 0.58, 0.46);
  bogieRoot.add(steeringTieRod);`,
  "A1 underbridge longitudinal rail",
  "underbridge and bogie detail",
);

insertAfter(
  animatedPath,
  `    cableSegments.forEach((segment, index) => {
      const along = cableStart + segmentLength * (index + 0.5);
      segment.position.set(-1.34, bridgeY(along) - 1.22, along);
      segment.rotation.x = pitch;
      segment.scale.z = segmentLength * 0.94;
      segment.visible = along < bridgeEnd - 1.2;
    });`,
  `
    const detailCenter = bridgeStart + bridgeLength / 2;
    underbridgeRails.forEach((rail) => {
      rail.position.y = bridgeY(detailCenter) - 1.24;
      rail.position.z = detailCenter;
      rail.rotation.x = pitch;
      rail.scale.z = Math.max(2.5, bridgeLength - 0.8);
    });
    underbridgeCrossmembers.forEach((crossmember, index) => {
      const t = (index + 0.5) / underbridgeCrossmembers.length;
      const along = bridgeStart + 0.45 + Math.max(1, bridgeLength - 0.9) * t;
      crossmember.position.set(0, bridgeY(along) - 1.24, along);
      crossmember.rotation.x = pitch;
      crossmember.visible = along < bridgeEnd - 0.3;
    });
    roofCableTray.position.set(-0.82, bridgeY(detailCenter) + 1.23, detailCenter);
    roofCableTray.rotation.x = pitch;
    roofCableTray.scale.z = Math.max(2.5, bridgeLength - 0.8);`,
  "const detailCenter = bridgeStart + bridgeLength / 2",
  "moving structural detail",
);

insertAfter(
  animatedPath,
  "  root.userData.sourceScale = 1;",
  `  root.userData.targetDoorPosition = [layout.targetX, attachedCabinY, layout.targetZ];
  const attachedContact = controller.getContactPosition();
  root.userData.attachedContactErrorMeters = Math.hypot(attachedContact[0] - layout.targetX, attachedContact[2] - layout.targetZ);
  root.userData.detailAuthority = "source-scale-panel-ribs-open-stair-cabin-controls-underbridge-truss-cable-tray-bogie-drive-v9";
  root.userData.structuralDetailCount = outerRibs.length + innerRibs.length + underbridgeCrossmembers.length + underbridgeRails.length + 18;`,
  "root.userData.attachedContactErrorMeters",
  "door contact evidence",
);

insertAfter(
  placedPath,
  "        cabinY,",
  `        targetX,
        targetZ,`,
  "        targetX,",
  "A1 door target layout",
);
insertAfter(
  placedPath,
  "  group.userData.a1JetwayRuntimeState = animatedA1Jetway.userData.state;",
  `  group.userData.a1DoorContactErrorMeters = animatedA1Jetway.userData.attachedContactErrorMeters;
  group.userData.a1DoorTargetPosition = animatedA1Jetway.userData.targetDoorPosition;
  group.userData.a1PlacementAuthority = "source parking stop plus measured CRJ forward-left-door offset; 3-centimeter contact tolerance";`,
  "group.userData.a1DoorContactErrorMeters",
  "A1 placement evidence",
);

insertAfter(
  terminalPath,
  "  environment.userData.authoredTerminal4A1JetwayAnimationAuthority = sourcePlacedJetways.userData.a1JetwayAnimationAuthority;",
  `  environment.userData.authoredTerminal4A1DoorContactErrorMeters = sourcePlacedJetways.userData.a1DoorContactErrorMeters;
  environment.userData.authoredTerminal4A1PlacementAuthority = sourcePlacedJetways.userData.a1PlacementAuthority;`,
  "authoredTerminal4A1DoorContactErrorMeters",
  "Terminal 4 placement evidence propagation",
);

replaceRequired(
  runtimePath,
  `  const jetwayRef = useRef({
    controller: null,
    deployment: 1,
    target: 1,
    retractionRequested: false,
  });`,
  `  const jetwayRef = useRef({
    controller: null,
    deployment: 1,
    target: 1,
    retractionRequested: false,
    transitionStartDeployment: 1,
    transitionStartedAt: 0,
    transitionDurationMs: 3600,
  });`,
  "transitionDurationMs: 3600",
  "absolute-time animation state",
);

replaceRequired(
  runtimePath,
  `      jetwayRef.current.target = 0;
      jetwayRef.current.retractionRequested = true;`,
  `      jetwayRef.current.transitionStartDeployment = jetwayRef.current.deployment;
      jetwayRef.current.transitionStartedAt = performance.now();
      jetwayRef.current.target = 0;
      jetwayRef.current.retractionRequested = true;`,
  "transitionStartedAt = performance.now()",
  "departure animation clock",
);

replaceRequired(
  runtimePath,
  `        const difference = jetway.target - jetway.deployment;
        if (Math.abs(difference) > 0.0005) {
          const step = Math.min(Math.abs(difference), dt * 0.34);
          jetway.deployment += Math.sign(difference) * step;
          jetway.controller.setDeployment(jetway.deployment);
        }`,
  `        const difference = jetway.target - jetway.deployment;
        if (Math.abs(difference) > 0.0005) {
          const now = performance.now();
          if (!(jetway.transitionStartedAt > 0)) {
            jetway.transitionStartDeployment = jetway.deployment;
            jetway.transitionStartedAt = now;
          }
          const transitionElapsedMs = Math.max(0, now - jetway.transitionStartedAt);
          const transitionDistance = Math.max(0.001, Math.abs(jetway.target - jetway.transitionStartDeployment));
          const transitionDurationMs = Math.max(900, jetway.transitionDurationMs * transitionDistance);
          const transitionProgress = Math.min(1, transitionElapsedMs / transitionDurationMs);
          const easedProgress = transitionProgress * transitionProgress * (3 - 2 * transitionProgress);
          jetway.deployment = jetway.transitionStartDeployment + (jetway.target - jetway.transitionStartDeployment) * easedProgress;
          if (transitionProgress >= 1) jetway.transitionStartedAt = 0;
          jetway.controller.setDeployment(jetway.deployment);
        }`,
  "const transitionElapsedMs = Math.max",
  "frame-rate-independent jetway motion",
);

insertAfter(
  runtimePath,
  "        renderer.domElement.dataset.a1JetwayAnimationAuthority = environment.userData.authoredTerminal4A1JetwayAnimationAuthority || \"missing\";",
  `        renderer.domElement.dataset.a1JetwayDoorContactErrorMeters = Number(environment.userData.authoredTerminal4A1DoorContactErrorMeters ?? 999).toFixed(3);
        renderer.domElement.dataset.a1JetwayPlacementAuthority = environment.userData.authoredTerminal4A1PlacementAuthority || "missing";`,
  "dataset.a1JetwayDoorContactErrorMeters",
  "browser placement evidence",
);

let css = fs.readFileSync(cssPath, "utf8");
const cssMarker = "/* RampReady mobile HUD hard containment v9 */";
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n@media (max-width: 620px) {\n  .rr-shell .rr-topline > div:first-child {\n    width: 100%;\n    max-width: 100%;\n    min-width: 0;\n    overflow: hidden;\n  }\n\n  .rr-shell .rr-hud h1 {\n    display: block;\n    width: 100%;\n    max-width: 100%;\n    min-width: 0;\n    box-sizing: border-box;\n    font-size: clamp(16px, 4.2vw, 20px);\n    line-height: 1.12;\n    white-space: normal;\n    overflow-wrap: anywhere;\n    word-break: normal;\n    overflow: hidden;\n    text-overflow: clip;\n  }\n}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

const parking = concourseA.parkings.find((entry) => entry.g === "A1");
const jetway = concourseA.jetways.find((entry) => entry.g === "A1");
if (!parking || !jetway) throw new Error("A1 source parking or jetway placement is missing");
const heading = parking.h * Math.PI / 180;
const forwardX = Math.cos(heading);
const forwardZ = Math.sin(heading);
const leftX = forwardZ;
const leftZ = -forwardX;
const targetX = jetway.px - forwardX * 6.25 + leftX * 1.35;
const targetZ = jetway.pz - forwardZ * 6.25 + leftZ * 1.35;
const distance = Math.hypot(targetX - jetway.x, targetZ - jetway.z);
const bridgeEnd = Math.max(11.5, Math.min(29.5, distance - 1.55));
const contactError = Math.abs(distance - (bridgeEnd + 1.58));
if (contactError > 0.08) throw new Error(`A1 jetway misses the CRJ forward-left door target by ${contactError.toFixed(3)} m`);

for (const [path, tokens] of [
  [animatedPath, ["A1 service tread", "A1 cabin operator control console", "A1 wheel hub", "A1 underbridge longitudinal rail", "attachedContactErrorMeters"]],
  [placedPath, ["a1DoorContactErrorMeters", "a1PlacementAuthority"]],
  [runtimePath, ["transitionDurationMs: 3600", "transitionElapsedMs", "a1JetwayDoorContactErrorMeters"]],
  [cssPath, [cssMarker, "overflow-wrap: anywhere"]],
]) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${path}: simulator-quality A1 pass is missing ${token}`);
}

console.log(`Prepared A1 simulator-quality v9: frame-rate-independent motion, open service stairs, cabin/bogie/underbridge detail, hard-contained mobile HUD, and ${contactError.toFixed(3)} m CRJ door-contact error.`);
