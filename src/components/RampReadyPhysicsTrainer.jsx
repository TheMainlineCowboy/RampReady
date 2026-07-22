import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildCRJ700Aircraft } from "./aircraft/crj700Model.js";
import {
  JACKKNIFE_WARNING,
  createPushbackState,
  stepPushbackDynamics,
} from "../simulation/pushbackDynamics.js";
import "./RampReadyTrainer.css";
import "./procedure-gates.css";

const NOSE_START_Z = 6.2;
const STOP_Z = 52;
const CRADLE_Z = 3.45;
const CONNECT_DISTANCE = 0.42;
const CONNECT_LATERAL_LIMIT = 0.2;
const CONNECT_HEADING_LIMIT = THREE.MathUtils.degToRad(6);
const CONNECT_SPEED_LIMIT = 0.12;
const TOW_SPEED_CAUTION = 1.05;
const CENTERLINE_CAUTION_OFFSET = 1.8;
const STOP_REMAINING_CAUTION = 12;

const STAGES = [
  "Complete visual equipment check",
  "Drive straight ahead and align with the nose gear",
  "Request pushback clearance",
  "Confirm aircraft parking brake released",
  "Push back on centerline and stop at the red line",
  "Lower cradle and release the nose gear",
  "Scenario complete",
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function mat(color, roughness = 0.62, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(r, depth, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, 32), mat(color, 0.78, 0.04));
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildGround(scene) {
  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(90, 140), mat(0x50545a, 0.95, 0.02));
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

function buildTug() {
  const group = new THREE.Group();
  const wheels = [];
  group.add(box(2.35, 0.42, 5.5, 0xb42324, 0, 0.55, -0.15));
  group.add(box(2.08, 0.11, 4.95, 0x20242b, 0, 0.82, -0.2));
  group.add(box(1.42, 0.32, 1.22, 0xb42324, 0, 0.92, -1.43));
  group.add(box(1.8, 0.1, 0.95, 0x111318, 0, 0.22, 2.75));
  group.add(box(1.7, 0.12, 0.9, 0x111318, 0, 0.34, CRADLE_Z));
  [-1, 1].forEach((side) => {
    group.add(box(0.16, 0.56, 0.85, 0xffcc00, side * 0.62, 0.55, CRADLE_Z));
    const rear = cyl(0.55, 0.42, 0x0c0d0f, side * 1.14, 0.48, -1.65, 0, 0, Math.PI / 2);
    const front = cyl(0.5, 0.38, 0x0c0d0f, side * 1.12, 0.47, 1.95, 0, 0, Math.PI / 2);
    wheels.push(rear, front);
    group.add(rear, front);
  });
  return { group, wheels };
}

function captureState(sim) {
  sim.tug.updateMatrixWorld(true);
  const cradle = new THREE.Vector3(0, 0, CRADLE_Z).applyMatrix4(sim.tug.matrixWorld);
  const delta = sim.aircraft.position.clone().sub(cradle);
  const right = new THREE.Vector3(Math.cos(sim.tug.rotation.y), 0, -Math.sin(sim.tug.rotation.y));
  const lateral = Math.abs(delta.dot(right));
  const heading = Math.abs(Math.atan2(
    Math.sin(sim.aircraft.rotation.y - sim.tug.rotation.y),
    Math.cos(sim.aircraft.rotation.y - sim.tug.rotation.y),
  ));
  const distance = delta.length();
  const ready = distance <= CONNECT_DISTANCE && lateral <= CONNECT_LATERAL_LIMIT && heading <= CONNECT_HEADING_LIMIT && Math.abs(sim.dynamics.speed) <= CONNECT_SPEED_LIMIT;
  let hint = `Close to ${distance.toFixed(1)} m`;
  if (Math.abs(sim.dynamics.speed) > CONNECT_SPEED_LIMIT) hint = "Stop tug";
  else if (heading > CONNECT_HEADING_LIMIT) hint = "Straighten tug";
  else if (lateral > CONNECT_LATERAL_LIMIT) hint = "Center cradle";
  return { cradle, distance, lateral, heading, ready, hint };
}

function dispose(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material?.dispose?.();
  });
}

export default function RampReadyPhysicsTrainer() {
  const mountRef = useRef(null);
  const simRef = useRef(null);
  const stageRef = useRef(0);
  const cameraRef = useRef("chase");
  const driveRef = useRef({ throttle: 0, steer: 0, brake: false, direction: 1 });
  const keysRef = useRef(new Set());
  const [stage, setStage] = useState(0);
  const [cameraMode, setCameraMode] = useState("chase");
  const [direction, setDirection] = useState("FWD");
  const [throttle, setThrottle] = useState(0);
  const [message, setMessage] = useState("Complete the equipment check, then approach the nose gear at idle speed.");
  const [hud, setHud] = useState({ speed: 0, stop: STOP_Z - NOSE_START_Z, capture: 0, ready: false, connected: false, articulation: 0, warning: false, score: 100 });
  const scoreRef = useRef(100);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { cameraRef.current = cameraMode; }, [cameraMode]);

  const reset = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.connected = false;
    sim.dynamics = createPushbackState();
    sim.tug.position.set(0, 0, 0);
    sim.tug.rotation.y = 0;
    sim.aircraft.position.set(0, 0, NOSE_START_Z);
    sim.aircraft.rotation.y = 0;
    driveRef.current = { throttle: 0, steer: 0, brake: false, direction: 1 };
    scoreRef.current = 100;
    stageRef.current = 0;
    setStage(0);
    setThrottle(0);
    setDirection("FWD");
    setMessage("Complete the equipment check, then approach the nose gear at idle speed.");
  }, []);

  const connect = useCallback(() => {
    const sim = simRef.current;
    if (!sim || sim.connected || stageRef.current !== 1) return;
    const capture = captureState(sim);
    if (!capture.ready) {
      setMessage(`${capture.hint} before connecting.`);
      return;
    }
    sim.connected = true;
    sim.dynamics = createPushbackState({
      tugX: sim.tug.position.x,
      tugZ: sim.tug.position.z,
      tugYaw: sim.tug.rotation.y,
      aircraftX: sim.aircraft.position.x,
      aircraftZ: sim.aircraft.position.z,
      aircraftYaw: sim.aircraft.rotation.y,
    });
    driveRef.current.throttle = 0;
    setThrottle(0);
    stageRef.current = 2;
    setStage(2);
    setMessage("Nose gear captured without repositioning. Request pushback clearance.");
  }, []);

  const advance = useCallback(() => {
    const sim = simRef.current;
    if (stageRef.current === 0) {
      stageRef.current = 1;
      setStage(1);
      setMessage("Approach slowly and stop when alignment is green.");
    } else if (stageRef.current === 2 && sim?.connected) {
      stageRef.current = 3;
      setStage(3);
      setMessage("Clearance received. Confirm parking brake release.");
    } else if (stageRef.current === 3 && sim?.connected && Math.abs(sim.dynamics.speed) < 0.05) {
      driveRef.current.direction = 1;
      driveRef.current.throttle = 0;
      setDirection("FWD");
      setThrottle(0);
      stageRef.current = 4;
      setStage(4);
      setMessage("Brake released. Add power gradually and steer smoothly.");
    }
  }, []);

  const release = useCallback(() => {
    const sim = simRef.current;
    if (!sim?.connected || stageRef.current !== 5) return;
    sim.connected = false;
    sim.dynamics.speed = 0;
    driveRef.current.throttle = 0;
    setThrottle(0);
    stageRef.current = 6;
    setStage(6);
    setMessage(`Nose gear lowered and released. Scenario complete. Score ${scoreRef.current}/100.`);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight, false);
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
    const { group: tug, wheels } = buildTug();
    const aircraft = buildCRJ700Aircraft(THREE, mat, cyl);
    aircraft.position.set(0, 0, NOSE_START_Z);
    aircraft.scale.setScalar(0.82);
    scene.add(tug, aircraft);

    const sim = { renderer, scene, camera, tug, wheels, aircraft, connected: false, dynamics: createPushbackState(), last: performance.now(), lastHud: 0 };
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
      const drive = driveRef.current;
      let steer = drive.steer;
      if (keysRef.current.has("a") || keysRef.current.has("arrowleft")) steer += 1;
      if (keysRef.current.has("d") || keysRef.current.has("arrowright")) steer -= 1;
      const towUnlocked = !sim.connected || stageRef.current === 4;
      const command = {
        connected: sim.connected,
        throttle: towUnlocked && (!sim.connected || drive.direction === 1) ? drive.throttle : 0,
        direction: drive.direction,
        steer: clamp(steer, -1, 1),
        brake: drive.brake || keysRef.current.has(" "),
        cradleOffset: CRADLE_Z,
      };
      sim.dynamics = stepPushbackDynamics(sim.dynamics, command, dt);
      const state = sim.dynamics;
      tug.position.set(state.tugX, 0, state.tugZ);
      tug.rotation.y = state.tugYaw;
      aircraft.position.set(state.aircraftX, 0, state.aircraftZ);
      aircraft.rotation.y = state.aircraftYaw;
      tug.updateMatrixWorld(true);
      wheels.forEach((wheel) => { wheel.rotation.x += state.speed * dt * 4; });

      const capture = captureState(sim);
      const crossline = Math.abs(state.aircraftX);
      const stopRemaining = STOP_Z - state.aircraftZ;
      if (sim.connected && stageRef.current === 4 && state.jackknifeWarning) {
        setMessage("Articulation limit approaching. Reduce power and steer back toward alignment.");
      }
      if (sim.connected && stageRef.current === 4 && Math.abs(state.speed) > TOW_SPEED_CAUTION && scoreRef.current > 0) scoreRef.current = Math.max(0, scoreRef.current - 0.02);
      if (sim.connected && stageRef.current === 4 && crossline > CENTERLINE_CAUTION_OFFSET && scoreRef.current > 0) scoreRef.current = Math.max(0, scoreRef.current - 0.02);
      if (sim.connected && stageRef.current === 4 && state.aircraftZ >= STOP_Z - 0.5) {
        const hard = Math.abs(state.speed) >= 0.18;
        if (hard) scoreRef.current = Math.max(0, scoreRef.current - 10);
        sim.dynamics.speed = 0;
        driveRef.current.throttle = 0;
        setThrottle(0);
        stageRef.current = 5;
        setStage(5);
        setMessage(hard ? "Stopped too hard. Lower and release the nose gear." : "Good stop. Lower and release the nose gear.");
      }

      const target = sim.connected ? aircraft.position : tug.position;
      if (cameraRef.current === "driver") {
        const eye = new THREE.Vector3(-0.45, 1.35, -2.15).applyMatrix4(tug.matrixWorld);
        camera.position.lerp(eye, 0.28);
        camera.lookAt(new THREE.Vector3(0, 1.1, 12).applyMatrix4(tug.matrixWorld));
      } else if (cameraRef.current === "overhead") {
        camera.position.lerp(new THREE.Vector3(target.x, 34, target.z + 2), 0.16);
        camera.lookAt(target.x, 0, target.z + 5);
      } else {
        camera.position.lerp(new THREE.Vector3(tug.position.x + 9, 6, tug.position.z - 12), 0.12);
        camera.lookAt(tug.position.x, 1, tug.position.z + 3);
      }

      if (now - sim.lastHud > 100) {
        sim.lastHud = now;
        setHud({
          speed: Math.abs(state.speed),
          stop: stopRemaining,
          capture: capture.distance,
          ready: !sim.connected && stageRef.current === 1 && capture.ready,
          connected: sim.connected,
          articulation: Math.abs(THREE.MathUtils.radToDeg(state.articulation)),
          warning: Math.abs(state.articulation) >= JACKKNIFE_WARNING,
          score: Math.round(scoreRef.current),
        });
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      dispose(scene);
      renderer.dispose();
      simRef.current = null;
    };
  }, []);

  useEffect(() => {
    const down = (event) => { keysRef.current.add(event.key.toLowerCase()); };
    const up = (event) => { keysRef.current.delete(event.key.toLowerCase()); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  return (
    <div className="rr-shell">
      <div ref={mountRef} className="rr-scene" />
      <section className="rr-hud">
        <div className="rr-topline"><div><div className="rr-kicker">Step {stage + 1} / {STAGES.length}</div><h1>{STAGES[stage]}</h1></div>
          <select className="rr-view-select" value={cameraMode} onChange={(event) => setCameraMode(event.target.value)}><option value="chase">Chase view</option><option value="driver">Driver view</option><option value="overhead">Overhead view</option></select>
        </div>
        <p>{message}</p>
        <div className="rr-hud-actions">
          {[0, 2, 3].includes(stage) && <button className="rr-primary" onClick={advance}>{stage === 0 ? "Ready" : stage === 2 ? "Clearance" : "Brake released"}</button>}
          {stage === 1 && <button className={hud.ready ? "rr-primary" : "rr-primary rr-disabled"} disabled={!hud.ready} onClick={connect}>{hud.ready ? "Capture nose gear" : `Align ${hud.capture.toFixed(1)} m`}</button>}
          {stage === 5 && <button className="rr-primary" onClick={release}>Lower and release</button>}
          <button className="rr-secondary" onClick={reset}>Reset</button>
        </div>
      </section>
      <aside className="rr-metrics"><span>Speed <b>{(hud.speed * 2.237).toFixed(1)} mph</b></span><span>Stop <b>{Math.max(0, hud.stop).toFixed(1)} m</b></span><span>Articulation <b>{hud.articulation.toFixed(1)}°</b></span><span>Nose <b>{hud.connected ? "Captured" : "Free"}</b></span></aside>
      <aside className="rr-score-float">Score <b>{hud.score}</b><span>{hud.warning ? "JACKKNIFE" : "Stable"}</span></aside>
      <div className="rr-steer"><button onPointerDown={() => { driveRef.current.steer = 1; }} onPointerUp={() => { driveRef.current.steer = 0; }}>◀</button><button onPointerDown={() => { driveRef.current.brake = true; }} onPointerUp={() => { driveRef.current.brake = false; }}>Brake</button><button onPointerDown={() => { driveRef.current.steer = -1; }} onPointerUp={() => { driveRef.current.steer = 0; }}>▶</button></div>
      <div className="rr-throttle"><button className="rr-direction" onClick={() => { const next = driveRef.current.direction === 1 ? -1 : 1; driveRef.current.direction = next; setDirection(next === 1 ? "FWD" : "REV"); }}>{direction}</button><input aria-label="Power" type="range" min="0" max="100" value={throttle} onChange={(event) => { const value = Number(event.target.value); setThrottle(value); driveRef.current.throttle = value / 100; }} /><button className="rr-idle" onClick={() => { driveRef.current.throttle = 0; setThrottle(0); }}>Idle</button><div className="rr-throttle-label">Power {throttle}%</div></div>
    </div>
  );
}
