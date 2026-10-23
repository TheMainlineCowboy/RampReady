// Final, deterministic pass after all Terminal 4 preparation scripts.
// Those generators rebuild the React component from a legacy stand-up trainer.
// Install the one-human readiness gate only after the original jetway animation
// and exact aircraft/gate pose have been prepared.
import fs from "node:fs";

function substitute(source,oldText,newText,label) {
  const pieces=source.split(oldText);
  if(pieces.length!==2)throw Error("A1 marshaller gate preparation failed ("+label+"): "+pieces.length+" occurrences");
  return pieces.join(newText);
}
const required=[
 "import { evaluateA1ApproachGate,isA1JetwayParked } from \"../simulation/a1MarshallerWorkflowGate.js\";",
 "const a1MarshallerRef = useRef(null);",
 "a1MarshallerRef.current = a1Marshaller;",
 "evaluateA1ApproachGate(jetway, a1MarshallerRef.current)",
 "stageRef.current !== 0 && approachGuideReady",
 "Capture locked: jetway must be parked and marshaller guiding.",
 "a1MarshallerReadyToGuide",
 "a1JetwayCompletelyParked",
];
export function applyA1MarshallerSequenceGate(
  path="src/components/RampReadyStandupTrainerTerminal4.jsx"
) {
  let code=fs.readFileSync(path,"utf8");
  // Already prepared and committed source: validate all guards; never append
  // another set of hooks or controls when the operation is repeated.
  if(code.includes(required[0])) {
    for(const part of required)
      if(!code.includes(part))throw Error("Incomplete existing A1 readiness gate: "+part);
    return {changed:false,verified:true};
  }
  code=substitute(code,
    'import { installA1LiveMarshaller } from "../simulation/a1LiveMarshaller.js";',
    'import { installA1LiveMarshaller } from "../simulation/a1LiveMarshaller.js";\n'+required[0],
    "import");
  code=substitute(code,'  const stageRef = useRef(0);',
    '  const stageRef = useRef(0);\n  const a1MarshallerRef = useRef(null);',"state");
  code=substitute(code,
    '      if (jetwayRef.current.retractionRequested) return;\n      const controller = jetwayRef.current.controller;',
    `      if (jetwayRef.current.retractionRequested) return;
      if (a1MarshallerRef.current?.status !== "ready") {
        setMessage(a1MarshallerRef.current?.status === "error"
          ? "Marshaller failed to load. Approach is locked until resolved."
          : "Preparing the marshaller before jetway retraction.");
        return;
      }
      const controller = jetwayRef.current.controller;`,
    "pre-retraction-load");
  code=substitute(code,
    '    if (!sim || inspectionRef.current || stageRef.current !== 1) return;\n    sim.connection = requestCapture',
    `    if (!sim || inspectionRef.current || stageRef.current !== 1) return;
    if (a1MarshallerRef.current?.readyToGuide !== true ||
        jetwayRef.current.deployment > 0.0005 ||
        !isA1JetwayParked(jetwayRef.current.controller)) {
      setMessage("Capture locked: jetway must be parked and marshaller guiding.");
      return;
    }
    sim.connection = requestCapture`,
    "capture");
  // At this final preparation stage, the generator installs the live NPC
  // on a single line. Match that exact declaration; do not assume the manually
  // expanded component layout from the review branch.
  const declaration="    const a1Marshaller = installA1LiveMarshaller(THREE,{scene,aircraft,rig,readStage:()=>stageRef.current,readInspection:()=>inspectionRef.current,readJetwayRetracting:()=>jetwayRef.current.retractionRequested});";
  if(code.includes(declaration)) {
    code=substitute(code,declaration,
      declaration+'\n    a1MarshallerRef.current = a1Marshaller;',"instance");
  } else {
    const expanded=`    const a1Marshaller = installA1LiveMarshaller(THREE,{
      scene,aircraft,rig,
      readStage:()=>stageRef.current,
      readInspection:()=>inspectionRef.current,
      readJetwayRetracting:()=>jetwayRef.current.retractionRequested,
    });`;
    code=substitute(code,expanded,expanded+'\n    a1MarshallerRef.current = a1Marshaller;',"expanded instance");
  }
  code=substitute(code,
    `        if (!inspectionActive && jetway.retractionRequested && jetway.deployment <= 0.005 && stageRef.current === 0) {
          jetway.retractionRequested = false;
          stageRef.current = 1;
          setStage(1);
          setMessage("Jetway parked clear. Approach directly from the front and stop inside the capture envelope.");
        }`,
    `        if (!inspectionActive && jetway.retractionRequested && stageRef.current === 0) {
          const gate = evaluateA1ApproachGate(jetway, a1MarshallerRef.current);
          if (gate.ready) {
            jetway.retractionRequested = false;
            stageRef.current = 1;
            setStage(1);
            setMessage("Jetway fully parked. Marshaller in position. Approach the nose gear at idle speed.");
          } else if (sim.lastA1GateMessage !== gate.reason) {
            sim.lastA1GateMessage = gate.reason;
            setMessage(gate.reason);
          }
        }`,
    "step progression");
  code=substitute(code,
    '      const motionAllowed = inspectionActive || (connectionAllowsMotion(sim.connection) && ![3, 4, 8].includes(stageRef.current));',
    `      const approachGuideReady = stageRef.current !== 1 || a1MarshallerRef.current?.readyToGuide === true;
      const motionAllowed = inspectionActive || (stageRef.current !== 0 && approachGuideReady &&
        connectionAllowsMotion(sim.connection) && ![3, 4, 8].includes(stageRef.current));`,
    "movement");
  const readable='      canvas.dataset.a1MarshallerStopReady = String(a1Marshaller.stopPoseReady);';
  const compact='      canvas.dataset.a1MarshallerStopReady=String(a1Marshaller.stopPoseReady);';
  const marker=code.includes(readable)?readable:compact;
  code=substitute(code,marker,
    marker+`\n      canvas.dataset.a1MarshallerReadyToGuide = String(a1Marshaller.readyToGuide);
      canvas.dataset.a1ApproachGateReady = String(stageRef.current>0||evaluateA1ApproachGate(jetway,a1Marshaller).ready);
      canvas.dataset.a1JetwayCompletelyParked = String(jetway.deployment<=0.0005&&isA1JetwayParked(jetway.controller));`,
    "telemetry");
  code=substitute(code,
    '      a1Marshaller.dispose();',
    '      a1Marshaller.dispose();\n      if(a1MarshallerRef.current===a1Marshaller)a1MarshallerRef.current=null;',
    "cleanup");
  for(const part of required)if(!code.includes(part))throw Error("A1 gate missing after generated pass: "+part);
  fs.writeFileSync(path,code,"utf8");
  return {changed:true,verified:true};
}
