import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildCRJ700Aircraft } from "./aircraft/crj700Model.js";
import { JACKKNIFE_WARNING, createPushbackState, stepPushbackDynamics } from "../simulation/pushbackDynamics.js";
import {
  CONNECTION_PHASES,
  beginTow,
  connectionAllowsMotion,
  connectionHasAircraft,
  createConnectionState,
  requestCapture,
  requestLower,
  stepConnection,
} from "../simulation/noseGearConnection.js";
import { createProceduralLektroRig, validateTugRig } from "../tug/lektroRig.js";
import "./RampReadyTrainer.css";
import "./procedure-gates.css";

const NOSE_START_Z = 6.2;
const STOP_Z = 52;
const STAGES = [
  "Complete visual equipment check",
  "Align the capture head with the nose gear",
  "Capture and secure the nose gear",
  "Request pushback clearance",
  "Confirm aircraft parking brake released",
  "Push back and stop at the red line",
  "Lower and release the nose gear",
  "Drive the tug clear",
  "Scenario complete",
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function material(color, roughness = 0.62, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function cylinder(radius, depth, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 32), material(color, 0.78, 0.04));
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function buildGround(scene) {
  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(90, 140), material(0x50545a, 0.95, 0.02));
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.z = 18;
  ramp.receiveShadow = true;
  scene.add(ramp);
  const center = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 130), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
  center.rotation.x = -Math.PI / 2;
  center.position.set(0, 0.018, 18);
  scene.add(center);
  const stop = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.32), new THREE.MeshBasicMaterial({ color: 0xff3434 }));
  stop.rotation.x = -Math.PI / 2;
  stop.position.set(0, 0.022, STOP_Z);
  scene.add(stop);
}
function connectionMetrics(sim) {
  const cradle = sim.rig.getCaptureWorld(new THREE.Vector3());
  const delta = sim.aircraft.position.clone().sub(cradle);
  const forward = new THREE.Vector3(Math.sin(sim.rig.root.rotation.y), 0, Math.cos(sim.rig.root.rotation.y));
  const right = new THREE.Vector3(Math.cos(sim.rig.root.rotation.y), 0, -Math.sin(sim.rig.root.rotation.y));
  const heading = Math.abs(Math.atan2(
    Math.sin(sim.aircraft.rotation.y - sim.rig.root.rotation.y),
    Math.cos(sim.aircraft.rotation.y - sim.rig.root.rotation.y),
  ));
  return {
    cradle,
    distance: delta.length(),
    lateral: Math.abs(delta.dot(right)),
    heading,
    speed: Math.abs(sim.dynamics.speed),
    fromFront: delta.dot(forward) >= -0.05,
  };
}
function dispose(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((entry) => entry.dispose());
    else child.material?.dispose?.();
  });
}

export default function RampReadyStandupTrainer() {
  const mountRef = useRef(null);
  const simRef = useRef(null);
  const stageRef = useRef(0);
  const cameraRef = useRef("chase");
  const driveRef = useRef({ throttle: 0, steer: 0, brake: false, direction: 1 });
  const keysRef = useRef(new Set());
  const scoreRef = useRef(100);
  const [stage, setStage] = useState(0);
  const [cameraMode, setCameraMode] = useState("chase");
  const [direction, setDirection] = useState("FWD");
  const [throttle, setThrottle] = useState(0);
  const [message, setMessage] = useState("Complete the equipment check, then approach at idle speed.");
  const [hud, setHud] = useState({ speed: 0, stop: STOP_Z - NOSE_START_Z, capture: 0, ready: false, articulation: 0, warning: false, score: 100, phase: CONNECTION_PHASES.APPROACH, progress: 0, tug: "Lektro rig" });
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { cameraRef.current = cameraMode; }, [cameraMode]);

  const reset = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.connection = createConnectionState();
    sim.dynamics = createPushbackState();
    sim.rig.root.position.set(0, 0, 0);
    sim.rig.root.rotation.y = 0;
    sim.rig.setSteering(0);
    sim.rig.setLiftProgress(0);
    sim.aircraft.position.set(0, 0, NOSE_START_Z);
    sim.aircraft.rotation.y = 0;
    driveRef.current = { throttle: 0, steer: 0, brake: false, direction: 1 };
    scoreRef.current = 100;
    stageRef.current = 0;
    setStage(0);
    setThrottle(0);
    setDirection("FWD");
    setMessage("Complete the equipment check, then approach at idle speed.");
  }, []);

  const advance = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    if (stageRef.current === 0) {
      stageRef.current = 1; setStage(1); setMessage("Approach directly from the front and stop inside the capture envelope.");
    } else if (stageRef.current === 3 && sim.connection.phase === CONNECTION_PHASES.SECURED) {
      stageRef.current = 4; setStage(4); setMessage("Clearance received. Confirm aircraft parking brake release.");
    } else if (stageRef.current === 4 && sim.connection.phase === CONNECTION_PHASES.SECURED) {
      sim.connection = beginTow(sim.connection);
      stageRef.current = 5; setStage(5); setMessage("Brake released. Add power gradually and steer smoothly.");
    }
  }, []);

  const capture = useCallback(() => {
    const sim = simRef.current;
    if (!sim || stageRef.current !== 1) return;
    sim.connection = requestCapture(sim.connection, connectionMetrics(sim));
    driveRef.current.throttle = 0;
    setThrottle(0);
    if (sim.connection.phase === CONNECTION_PHASES.CAPTURING) {
      stageRef.current = 2; setStage(2);
    }
    setMessage(sim.connection.reason);
  }, []);

  const lower = useCallback(() => {
    const sim = simRef.current;
    if (!sim || stageRef.current !== 6) return;
    sim.connection = requestLower(sim.connection, sim.dynamics.speed, sim.dynamics.articulation);
    driveRef.current.throttle = 0;
    setThrottle(0);
    setMessage(sim.connection.reason);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "trainerCanvas";
    mount.replaceChildren(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fc4e6);
    scene.fog = new THREE.Fog(0x9fc4e6, 70, 140);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x58616b, 1.45));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(18, 28, -14);
    sun.castShadow = true;
    scene.add(sun);
    buildGround(scene);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500);
    const rig = createProceduralLektroRig(THREE);
    const rigFailures = validateTugRig(rig);
    if (rigFailures.length) throw new Error(`Invalid tug rig: ${rigFailures.join(", ")}`);
    const aircraft = buildCRJ700Aircraft(THREE, material, cylinder);
    aircraft.position.set(0, 0, NOSE_START_Z);
    aircraft.scale.setScalar(0.82);
    scene.add(rig.root, aircraft);
    const sim = { renderer, scene, camera, rig, aircraft, connection: createConnectionState(), dynamics: createPushbackState(), last: performance.now(), lastHud: 0 };
    simRef.current = sim;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth || window.innerWidth);
      const height = Math.max(1, mount.clientHeight || window.innerHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    window.addEventListener("resize", resize);
    let frame = 0;
    const tick = (now) => {
      const dt = Math.min(0.04, Math.max(0.001, (now - sim.last) / 1000));
      sim.last = now;
      const before = connectionMetrics(sim);
      const clearDistance = Math.hypot(rig.root.position.x - aircraft.position.x, rig.root.position.z - aircraft.position.z);
      sim.connection = stepConnection(sim.connection, { metrics: before, speed: sim.dynamics.speed, clearDistance }, dt);
      if (stageRef.current === 2 && sim.connection.phase === CONNECTION_PHASES.SECURED) {
        sim.dynamics = createPushbackState({ tugX: rig.root.position.x, tugZ: rig.root.position.z, tugYaw: rig.root.rotation.y, aircraftX: aircraft.position.x, aircraftZ: aircraft.position.z, aircraftYaw: aircraft.rotation.y });
        stageRef.current = 3; setStage(3); setMessage("Nose gear lifted and secured. Request pushback clearance.");
      }
      if (stageRef.current === 6 && sim.connection.phase === CONNECTION_PHASES.RELEASED) {
        stageRef.current = 7; setStage(7); setMessage("Nose gear released. Select REV and drive at least 2.2 m clear.");
      }
      if (stageRef.current === 7 && sim.connection.phase === CONNECTION_PHASES.CLEAR) {
        driveRef.current.throttle = 0; setThrottle(0); stageRef.current = 8; setStage(8); setMessage(`Tug clear. Scenario complete. Score ${Math.round(scoreRef.current)}/100.`);
      }
      const drive = driveRef.current;
      let steer = drive.steer;
      if (keysRef.current.has("a") || keysRef.current.has("arrowleft")) steer += 1;
      if (keysRef.current.has("d") || keysRef.current.has("arrowright")) steer -= 1;
      const motionAllowed = connectionAllowsMotion(sim.connection) && ![3, 4, 8].includes(stageRef.current);
      const towing = sim.connection.phase === CONNECTION_PHASES.TOWING;
      sim.dynamics = stepPushbackDynamics(sim.dynamics, {
        connected: towing,
        throttle: motionAllowed && (!towing || drive.direction === 1) ? drive.throttle : 0,
        direction: drive.direction,
        steer: clamp(steer, -1, 1),
        brake: drive.brake || keysRef.current.has(" ") || !motionAllowed,
        cradleOffset: rig.profile.cradleOffset,
      }, dt);
      const state = sim.dynamics;
      rig.root.position.set(state.tugX, 0, state.tugZ);
      rig.root.rotation.y = state.tugYaw;
      rig.setSteering(state.steerAngle || 0);
      rig.rotateWheels(state.speed * dt);
      if (connectionHasAircraft(sim.connection)) {
        aircraft.position.set(state.aircraftX, 0, state.aircraftZ);
        aircraft.rotation.y = state.aircraftYaw;
      }
      const lift = sim.connection.phase === CONNECTION_PHASES.CAPTURING ? sim.connection.progress : sim.connection.phase === CONNECTION_PHASES.LOWERING ? 1 - sim.connection.progress : connectionHasAircraft(sim.connection) ? 1 : 0;
      rig.setLiftProgress(lift);
      const metrics = connectionMetrics(sim);
      const stopRemaining = STOP_Z - state.aircraftZ;
      if (towing && state.jackknifeWarning) setMessage("Articulation limit approaching. Reduce power and steer toward alignment.");
      if (towing && (Math.abs(state.speed) > 1.05 || Math.abs(state.aircraftX) > 1.8)) scoreRef.current = Math.max(0, scoreRef.current - 0.02);
      if (towing && state.aircraftZ >= STOP_Z - 0.5) {
        const hard = Math.abs(state.speed) >= 0.18;
        if (hard) scoreRef.current = Math.max(0, scoreRef.current - 10);
        sim.dynamics.speed = 0; driveRef.current.throttle = 0; setThrottle(0); stageRef.current = 6; setStage(6); setMessage(hard ? "Stopped too hard. Straighten, then lower." : "Good stop. Straighten, then lower.");
      }
      const target = connectionHasAircraft(sim.connection) ? aircraft.position : rig.root.position;
      if (cameraRef.current === "driver") {
        camera.position.lerp(rig.getOperatorEyeWorld(new THREE.Vector3()), 0.28);
        camera.lookAt(rig.getOperatorLookWorld(new THREE.Vector3()));
      } else if (cameraRef.current === "overhead") {
        camera.position.lerp(new THREE.Vector3(target.x, 34, target.z + 2), 0.16);
        camera.lookAt(target.x, 0, target.z + 5);
      } else {
        camera.position.lerp(new THREE.Vector3(rig.root.position.x + 9, 6, rig.root.position.z - 12), 0.12);
        camera.lookAt(rig.root.position.x, 1, rig.root.position.z + 3);
      }
      if (now - sim.lastHud > 100) {
        sim.lastHud = now;
        setHud({ speed: Math.abs(state.speed), stop: stopRemaining, capture: metrics.distance, ready: sim.connection.phase === CONNECTION_PHASES.ALIGNED, articulation: Math.abs(THREE.MathUtils.radToDeg(state.articulation)), warning: Math.abs(state.articulation) >= JACKKNIFE_WARNING, score: Math.round(scoreRef.current), phase: sim.connection.phase, progress: sim.connection.progress, tug: rig.profile.id });
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); dispose(scene); renderer.dispose(); simRef.current = null; };
  }, []);

  useEffect(() => {
    const down = (event) => keysRef.current.add(event.key.toLowerCase());
    const up = (event) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  return <div className="rr-shell">
    <div ref={mountRef} className="rr-scene" />
    <section className="rr-hud">
      <div className="rr-topline"><div><div className="rr-kicker">Step {stage + 1} / {STAGES.length}</div><h1>{STAGES[stage]}</h1></div><select className="rr-view-select" value={cameraMode} onChange={(event) => setCameraMode(event.target.value)}><option value="chase">Chase view</option><option value="driver">Operator view</option><option value="overhead">Overhead view</option></select></div>
      <p>{message}</p>
      <div className="rr-hud-actions">
        {[0, 3, 4].includes(stage) && <button className="rr-primary" onClick={advance}>{stage === 0 ? "Ready" : stage === 3 ? "Clearance" : "Brake released"}</button>}
        {stage === 1 && <button className={hud.ready ? "rr-primary" : "rr-primary rr-disabled"} disabled={!hud.ready} onClick={capture}>{hud.ready ? "Capture nose gear" : `Align ${hud.capture.toFixed(1)} m`}</button>}
        {stage === 6 && <button className="rr-primary" onClick={lower}>Lower cradle</button>}
        <button className="rr-secondary" onClick={reset}>Reset</button>
      </div>
    </section>
    <aside className="rr-metrics"><span>Tug <b>{hud.tug}</b></span><span>Speed <b>{(hud.speed * 2.237).toFixed(1)} mph</b></span><span>Stop <b>{Math.max(0, hud.stop).toFixed(1)} m</b></span><span>Articulation <b>{hud.articulation.toFixed(1)}°</b></span><span>Connection <b>{hud.phase}</b></span>{[CONNECTION_PHASES.CAPTURING, CONNECTION_PHASES.LOWERING].includes(hud.phase) && <span>Cycle <b>{Math.round(hud.progress * 100)}%</b></span>}</aside>
    <aside className="rr-score-float">Score <b>{hud.score}</b><span>{hud.warning ? "JACKKNIFE" : "Stable"}</span></aside>
    <div className="rr-steer"><button onPointerDown={() => { driveRef.current.steer = 1; }} onPointerUp={() => { driveRef.current.steer = 0; }}>◀</button><button onPointerDown={() => { driveRef.current.brake = true; }} onPointerUp={() => { driveRef.current.brake = false; }}>Brake</button><button onPointerDown={() => { driveRef.current.steer = -1; }} onPointerUp={() => { driveRef.current.steer = 0; }}>▶</button></div>
    <div className="rr-throttle"><button className="rr-direction" onClick={() => { const next = driveRef.current.direction === 1 ? -1 : 1; driveRef.current.direction = next; setDirection(next === 1 ? "FWD" : "REV"); }}>{direction}</button><input aria-label="Power" type="range" min="0" max="100" value={throttle} onChange={(event) => { const value = Number(event.target.value); setThrottle(value); driveRef.current.throttle = value / 100; }} /><button className="rr-idle" onClick={() => { driveRef.current.throttle = 0; setThrottle(0); }}>Idle</button><div className="rr-throttle-label">Power {throttle}%</div></div>
  </div>;
}
