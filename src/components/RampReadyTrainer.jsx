import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildCRJ700Aircraft } from "./aircraft/crj700Model.js";
import "./RampReadyTrainer.css";

const STAGES = [
  "Complete visual equipment check",
  "Drive straight ahead and capture the nose wheels",
  "Request pushback clearance",
  "Confirm aircraft parking brake released",
  "Push back on centerline and stop at the red line",
  "Lower cradle and release the nose gear",
  "Scenario complete",
];

const NOSE_START_Z = 9;
const STOP_Z = 64;
const CRADLE_Z = 4.85;
const CONNECT_CAPTURE_DISTANCE = 1.55;
const CONNECT_SPEED_LIMIT = 0.55;
const MAX_FREE_SPEED = 4.2;
const MAX_TOW_SPEED = 1.65;
const MAX_STEER = 0.55;
const CENTERLINE_TOLERANCE = 2.4;
const RECOMMENDED_PUSH_SPEED = 1.25;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mat(color, roughness = 0.62, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(r, depth, color, x, y, z, rx = 0, ry = 0, rz = 0, segments = 28) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, segments), mat(color, 0.78, 0.04));
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function stageHelp(stageIndex, connected) {
  if (stageIndex === 1) return "Approach slowly. When capture distance is green, stop and tap Connect nose gear.";
  if (stageIndex === 4) return "Use REV and small throttle changes. Hold centerline and stop on the red line.";
  if (connected) return "Nose gear captured. Keep the tug straight and wait for the next clearance step.";
  return "Tap and drag the scene to look around. Use the right-side power slider for movement.";
}

function buildGround(scene) {
  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(120, 160), mat(0x474b52, 0.94, 0.02));
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.z = 36;
  ramp.receiveShadow = true;
  scene.add(ramp);

  const center = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 112), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
  center.rotation.x = -Math.PI / 2;
  center.position.set(0, 0.018, 40);
  scene.add(center);

  const stop = new THREE.Mesh(new THREE.PlaneGeometry(13, 0.36), new THREE.MeshBasicMaterial({ color: 0xff3535 }));
  stop.rotation.x = -Math.PI / 2;
  stop.position.set(0, 0.022, STOP_Z);
  scene.add(stop);

  for (let z = -24; z <= 104; z += 12) {
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(110, 0.035), new THREE.MeshBasicMaterial({ color: 0x565c64 }));
    seam.rotation.x = -Math.PI / 2;
    seam.position.set(0, 0.021, z);
    scene.add(seam);
  }
}

function buildLektro() {
  const group = new THREE.Group();
  const wheels = [];
  const red = 0xb42324;
  const black = 0x111318;
  const deck = 0x1c1f24;
  const yellow = 0xffcc00;

  group.add(box(2.25, 0.42, 5.8, red, 0, 0.56, 0.05));
  group.add(box(2.05, 0.1, 5.35, deck, 0, 0.82, 0.05));
  group.add(box(2.1, 0.44, 1.0, 0x801516, 0, 0.63, -2.45));
  group.add(box(1.55, 0.34, 1.35, red, 0, 0.92, -1.45));
  group.add(box(0.55, 0.42, 0.42, 0xd8d2c8, -0.52, 1.1, -2.18, 0.12));
  group.add(box(0.55, 0.42, 0.42, 0xd8d2c8, 0.52, 1.1, -2.18, 0.12));
  group.add(cyl(0.23, 0.045, black, -0.58, 1.28, -1.48, Math.PI / 2.2, 0, 0, 36));
  group.add(cyl(0.09, 0.12, 0xff9900, 0, 1.37, -1.95));
  group.add(cyl(0.13, 0.72, 0xd63a30, 0.78, 1.08, -1.55, Math.PI / 2, 0.25));

  group.add(box(1.55, 0.12, 1.02, black, 0, 0.36, CRADLE_Z));
  group.add(box(2.25, 0.08, 1.0, black, 0, 0.12, CRADLE_Z + 0.85, -0.18));
  group.add(box(1.2, 0.1, 1.4, black, 0, 0.16, CRADLE_Z - 0.9, -0.08));
  [-1, 1].forEach((s) => {
    group.add(box(0.14, 0.55, 1.2, yellow, s * 0.68, 0.54, CRADLE_Z + 0.04, 0, 0, -s * 0.13));
    group.add(box(0.12, 0.42, 0.9, black, s * 0.98, 0.42, CRADLE_Z + 0.24));
  });

  [-1, 1].forEach((s) => {
    const rear = cyl(0.56, 0.42, 0x0c0d0f, s * 1.14, 0.48, -1.65, 0, 0, Math.PI / 2, 40);
    const front = cyl(0.5, 0.38, 0x0c0d0f, s * 1.12, 0.47, 2.12, 0, 0, Math.PI / 2, 40);
    wheels.push(rear, front);
    group.add(rear, front);
    group.add(cyl(0.26, 0.44, 0xaeb4bc, s * 1.15, 0.48, -1.65, 0, 0, Math.PI / 2, 36));
    group.add(cyl(0.23, 0.4, 0xaeb4bc, s * 1.13, 0.47, 2.12, 0, 0, Math.PI / 2, 36));
  });

  group.add(box(2.35, 0.18, 0.14, 0x801516, 0, 0.8, -2.95));
  return { group, wheels };
}

function buildAircraft() {
  return buildCRJ700Aircraft(THREE, mat, cyl);
}

function dispose(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
}

export default function RampReadyTrainer() {
  const mountRef = useRef(null);
  const simRef = useRef(null);
  const stageRef = useRef(0);
  const keysRef = useRef(new Set());
  const driveRef = useRef({ throttle: 0, steer: 0, brake: false, direction: 1 });
  const camModeRef = useRef("chase");
  const camRef = useRef({ yaw: 0.15, pitch: 0.1, distance: 18, height: 4.8, manualYaw: 0, manualPitch: 0, gyroYaw: 0, gyroPitch: 0 });
  const pointerRef = useRef({ active: false, x: 0, y: 0 });
  const throttleDragRef = useRef(false);
  const gyroRef = useRef(false);

  const [stageIndex, setStageIndex] = useState(0);
  const [cameraMode, setCameraModeState] = useState("chase");
  const [gyro, setGyro] = useState(false);
  const [direction, setDirection] = useState("FWD");
  const [throttle, setThrottle] = useState(0);
  const [hud, setHud] = useState({ speed: 0, distance: STOP_Z - NOSE_START_Z, offset: 0, connected: false, warning: "", connectDistance: null, connectReady: false });
  const [message, setMessage] = useState("Clean test scene. Use the right-side power slider and FWD/REV toggle to verify movement.");
  const [finalScore, setFinalScore] = useState(null);

  const setCameraMode = useCallback((mode) => {
    const presets = {
      chase: { yaw: 0.15, pitch: 0.1, distance: 18, height: 4.8 },
      driver: { yaw: 0, pitch: 0, distance: 0, height: 1.42 },
      overhead: { yaw: 0, pitch: 1.1, distance: 38, height: 32 },
    };
    camModeRef.current = mode;
    camRef.current = { ...presets[mode], manualYaw: 0, manualPitch: 0, gyroYaw: 0, gyroPitch: 0 };
    setCameraModeState(mode);
  }, []);

  const setThrottleValue = useCallback((value) => {
    const next = clamp(Number(value), 0, 100);
    driveRef.current.throttle = next / 100;
    setThrottle(next);
  }, []);

  const updateCustomThrottle = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    const next = Math.round((1 - y / rect.height) * 100);
    setThrottleValue(next);
    event.preventDefault();
  }, [setThrottleValue]);

  const beginThrottleDrag = useCallback((event) => {
    throttleDragRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateCustomThrottle(event);
  }, [updateCustomThrottle]);

  const moveThrottleDrag = useCallback((event) => {
    if (!throttleDragRef.current) return;
    updateCustomThrottle(event);
  }, [updateCustomThrottle]);

  const endThrottleDrag = useCallback((event) => {
    throttleDragRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  const toggleDirection = useCallback(() => {
    const next = driveRef.current.direction === 1 ? -1 : 1;
    driveRef.current.direction = next;
    setDirection(next === 1 ? "FWD" : "REV");
  }, []);

  const connectNoseGear = useCallback(() => {
    const sim = simRef.current;
    if (!sim || sim.connected || stageRef.current !== 1) return;
    sim.tug.updateMatrixWorld(true);
    const cradle = new THREE.Vector3(0, 0, CRADLE_Z).applyMatrix4(sim.tug.matrixWorld);
    const dist = cradle.distanceTo(sim.aircraft.position);
    if (dist > CONNECT_CAPTURE_DISTANCE) {
      setMessage(`Move closer before connecting. Capture distance: ${dist.toFixed(1)} m.`);
      return;
    }
    if (Math.abs(sim.velocity) > CONNECT_SPEED_LIMIT) {
      setMessage("Stop or slow almost to zero before connecting the nose gear.");
      return;
    }
    sim.connected = true;
    sim.velocity = 0;
    driveRef.current.throttle = 0;
    setThrottle(0);
    setMessage("Nose wheels captured. Power returned to idle. Request clearance next.");
    stageRef.current = 2;
    setStageIndex(2);
  }, []);

  const reset = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.tug.position.set(0, 0, 0);
    sim.tug.rotation.y = 0;
    sim.aircraft.position.set(0, 0, NOSE_START_Z);
    sim.aircraft.rotation.y = 0;
    sim.velocity = 0;
    sim.steer = 0;
    sim.connected = false;
    sim.centerPenalty = 0;
    sim.speedPenalty = 0;
    sim.missedStop = false;
    throttleDragRef.current = false;
    driveRef.current = { throttle: 0, steer: 0, brake: false, direction: 1 };
    stageRef.current = 0;
    setStageIndex(0);
    setThrottle(0);
    setDirection("FWD");
    setFinalScore(null);
    setHud((old) => ({ ...old, connected: false, connectDistance: null, connectReady: false }));
    setMessage("Scenario reset. Use the right-side power slider and FWD/REV toggle to test movement.");
  }, []);

  useEffect(() => { stageRef.current = stageIndex; }, [stageIndex]);

  useEffect(() => {
    const onOrientation = (event) => {
      if (!gyroRef.current) return;
      camRef.current.gyroYaw = clamp((event.gamma ?? 0) / 45, -1, 1) * 0.8;
      camRef.current.gyroPitch = clamp(((event.beta ?? 55) - 55) / 50, -1, 1) * 0.7;
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, []);

  useEffect(() => {
    let raf = 0;
    const mount = mountRef.current;
    if (!mount) return undefined;

    const onPointerDown = (event) => {
      if (event.target !== mount && event.target !== simRef.current?.renderer.domElement) return;
      pointerRef.current = { active: true, x: event.clientX, y: event.clientY };
      event.preventDefault();
    };
    const onPointerMove = (event) => {
      if (!pointerRef.current.active) return;
      const dx = event.clientX - pointerRef.current.x;
      const dy = event.clientY - pointerRef.current.y;
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
      camRef.current.manualYaw += dx * 0.007;
      camRef.current.manualPitch = clamp(camRef.current.manualPitch - dy * 0.007, -1.05, 1.05);
      event.preventDefault();
    };
    const onPointerUp = () => { pointerRef.current.active = false; };

    const width = Math.max(1, mount.clientWidth || window.innerWidth || 1);
    const height = Math.max(1, mount.clientHeight || window.innerHeight || 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "trainerCanvas";
    mount.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fc4e6);
    scene.fog = new THREE.Fog(0x9fc4e6, 75, 150);
    const camera = new THREE.PerspectiveCamera(64, width / height, 0.1, 500);
    camera.position.set(0, 5.5, -18);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x58616b, 1.45));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(16, 28, -10);
    sun.castShadow = true;
    scene.add(sun);

    buildGround(scene);
    const { group: tug, wheels } = buildLektro();
    const aircraft = buildAircraft();
    aircraft.position.set(0, 0, NOSE_START_Z);
    scene.add(tug, aircraft);

    const sim = { scene, renderer, camera, tug, wheels, aircraft, velocity: 0, steer: 0, connected: false, last: performance.now(), centerPenalty: 0, speedPenalty: 0, missedStop: false };
    simRef.current = sim;

    mount.addEventListener("pointerdown", onPointerDown, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    const onResize = () => {
      const w = Math.max(1, mount.clientWidth || window.innerWidth || 1);
      const h = Math.max(1, mount.clientHeight || window.innerHeight || 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener("resize", onResize);

    const tick = (now) => {
      const dt = Math.min(0.04, (now - sim.last) / 1000 || 0.016);
      sim.last = now;
      const keys = keysRef.current;
      const drive = driveRef.current;
      let steerInput = drive.steer;
      if (keys.has("a") || keys.has("arrowleft")) steerInput += 1;
      if (keys.has("d") || keys.has("arrowright")) steerInput -= 1;
      steerInput = clamp(steerInput, -1, 1);

      const keyboardThrottle = keys.has("w") || keys.has("arrowup") ? 1 : keys.has("s") || keys.has("arrowdown") ? -1 : 0;
      const towPhase = sim.connected && stageRef.current >= 4;
      const effectiveDirection = towPhase ? -drive.direction : drive.direction;
      const commandedThrottle = keyboardThrottle || drive.throttle * effectiveDirection;
      const maxSpeed = sim.connected ? MAX_TOW_SPEED : MAX_FREE_SPEED;
      const targetSpeed = commandedThrottle * maxSpeed;
      const response = sim.connected ? 1 - Math.exp(-2.2 * dt) : 1 - Math.exp(-3.4 * dt);
      sim.velocity = lerp(sim.velocity, targetSpeed, response);
      if (drive.brake || keys.has(" ")) {
        sim.velocity -= Math.sign(sim.velocity) * Math.min(Math.abs(sim.velocity), (sim.connected ? 2.2 : 4.2) * dt);
      }
      if (Math.abs(commandedThrottle) < 0.03) {
        sim.velocity -= Math.sign(sim.velocity) * Math.min(Math.abs(sim.velocity), (sim.connected ? 0.22 : 0.55) * dt);
      }
      sim.velocity = clamp(sim.velocity, -maxSpeed, maxSpeed);
      if (Math.abs(sim.velocity) < 0.01) sim.velocity = 0;

      sim.tug.rotation.y += (sim.velocity / 2.34) * Math.tan(sim.steer) * dt;
      sim.tug.position.x += Math.sin(sim.tug.rotation.y) * sim.velocity * dt;
      sim.tug.position.z += Math.cos(sim.tug.rotation.y) * sim.velocity * dt;
      sim.tug.updateMatrixWorld(true);
      sim.wheels.forEach((wheel) => { wheel.rotation.x += sim.velocity * dt * 4; });

      const cradle = new THREE.Vector3(0, 0, CRADLE_Z).applyMatrix4(sim.tug.matrixWorld);
      const dist = cradle.distanceTo(sim.aircraft.position);
      const connectReady = !sim.connected && stageRef.current === 1 && dist <= CONNECT_CAPTURE_DISTANCE && Math.abs(sim.velocity) <= CONNECT_SPEED_LIMIT;

      if (sim.connected) {
        sim.aircraft.position.x = cradle.x;
        sim.aircraft.position.z = cradle.z;
        sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.6 * dt));
      }

      const noseZ = sim.aircraft.position.z;
      const offset = Math.abs(sim.aircraft.position.x);
      if (stageRef.current === 4) {
        if (offset > CENTERLINE_TOLERANCE) sim.centerPenalty += dt;
        if (Math.abs(sim.velocity) > RECOMMENDED_PUSH_SPEED) sim.speedPenalty += dt;
        if (noseZ > STOP_Z + 2) sim.missedStop = true;
      }
      if (sim.connected && stageRef.current === 4 && noseZ >= STOP_Z - 0.5 && Math.abs(sim.velocity) < 0.14) {
        sim.velocity = 0;
        driveRef.current.throttle = 0;
        setThrottle(0);
        const score = clamp(100 - Math.round(sim.centerPenalty * 8 + sim.speedPenalty * 6 + (sim.missedStop ? 20 : 0)), 60, 100);
        setFinalScore(score);
        setMessage(score >= 90 ? "Good controlled stop. Release the nose gear." : "Stopped at the line. Release the nose gear, then retry for a smoother score.");
        stageRef.current = 5;
        setStageIndex(5);
      }

      let warning = stageHelp(stageRef.current, sim.connected);
      if (stageRef.current === 1 && dist > CONNECT_CAPTURE_DISTANCE) warning = `Capture distance: ${dist.toFixed(1)} m. Move forward slowly.`;
      else if (stageRef.current === 1 && Math.abs(sim.velocity) > CONNECT_SPEED_LIMIT) warning = "In capture range, but slow/stop before connecting.";
      else if (stageRef.current === 1 && connectReady) warning = "Capture distance green. Tap Connect nose gear.";
      else if (stageRef.current === 4 && drive.direction !== -1) warning = "Direction should be REV for pushback. Tap the FWD/REV button, then add power slowly.";
      else if (stageRef.current === 4 && offset > CENTERLINE_TOLERANCE) warning = "Correct back toward centerline.";
      else if (stageRef.current === 4 && Math.abs(sim.velocity) > RECOMMENDED_PUSH_SPEED) warning = "Ease off power. Pushback speed is high.";

      const look = camRef.current;
      const target = new THREE.Vector3(sim.connected ? sim.aircraft.position.x : sim.tug.position.x, 1.1, sim.connected ? sim.aircraft.position.z : sim.tug.position.z + 2.5);
      const yaw = sim.tug.rotation.y + look.yaw + look.manualYaw + look.gyroYaw;
      const pitch = clamp(look.pitch + look.manualPitch + look.gyroPitch, -1.15, 1.15);
      if (camModeRef.current === "driver") {
        const eye = new THREE.Vector3(-0.52, 1.35, -2.25).applyMatrix4(sim.tug.matrixWorld);
        const forward = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
        camera.position.lerp(eye, 0.35);
        camera.lookAt(eye.clone().add(forward.multiplyScalar(24)));
      } else {
        const horizontal = Math.cos(pitch) * look.distance;
        const orbit = new THREE.Vector3(Math.sin(yaw) * horizontal, look.height + Math.sin(pitch) * look.distance, -Math.cos(yaw) * horizontal);
        camera.position.lerp(target.clone().add(orbit), 0.12);
        camera.lookAt(target.x, target.y + 1.2, target.z + 4.5);
      }

      setHud({ speed: Math.abs(sim.velocity), distance: STOP_Z - noseZ, offset, connected: sim.connected, warning, connectDistance: dist, connectReady });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      mount.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      dispose(scene);
      renderer.dispose();
      simRef.current = null;
    };
  }, []);

  useEffect(() => {
    const prevent = new Set([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
    const down = (event) => { if (prevent.has(event.key)) event.preventDefault(); keysRef.current.add(event.key.toLowerCase()); };
    const up = (event) => { if (prevent.has(event.key)) event.preventDefault(); keysRef.current.delete(event.key.toLowerCase()); };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up, { passive: false });
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const onStageAction = () => {
    if (stageIndex === 0) setMessage("Inspection complete. Approach slowly and straight ahead.");
    if (stageIndex === 2) setMessage("Clearance received. Confirm brake release.");
    if (stageIndex === 3) {
      driveRef.current.direction = -1;
      driveRef.current.throttle = 0;
      setDirection("REV");
      setThrottle(0);
      setMessage("Brake released. Direction set to REV for pushback. Add power slowly and stop at the red line.");
    }
    if (stageIndex === 5) { setMessage("Scenario complete. Good controlled stop."); }
    setStageIndex((idx) => { const next = clamp(idx + 1, 0, STAGES.length - 1); stageRef.current = next; return next; });
  };

  const toggleGyro = async () => {
    const next = !gyroRef.current;
    if (next && typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission().catch(() => "denied");
      if (permission !== "granted") return setMessage("Gyro permission was not granted. Drag-look still works.");
    }
    gyroRef.current = next;
    setGyro(next);
    setMessage(next ? "Gyro Look enabled." : "Gyro Look off.");
  };

  return (
    <div className="rr-shell">
      <div ref={mountRef} className="rr-scene" />
      <section className="rr-hud">
        <div className="rr-topline">
          <div>
            <div className="rr-kicker">Step {stageIndex + 1} / {STAGES.length}</div>
            <h1>{STAGES[stageIndex]}</h1>
          </div>
          <select className="rr-view-select" value={cameraMode} onChange={(event) => setCameraMode(event.target.value)} aria-label="Camera view">
            <option value="chase">Chase view</option>
            <option value="driver">Driver view</option>
            <option value="overhead">Overhead view</option>
          </select>
        </div>
        <p>{message}</p>
        <div className="rr-hud-actions">
          {[0, 2, 3, 5].includes(stageIndex) && <button className="rr-primary" onClick={onStageAction}>{stageIndex === 0 ? "Ready" : stageIndex === 2 ? "Clearance" : stageIndex === 3 ? "Brake released" : "Release gear"}</button>}
          {stageIndex === 1 && <button className={hud.connectReady ? "rr-primary" : "rr-primary rr-disabled"} disabled={!hud.connectReady} onClick={connectNoseGear}>{hud.connectReady ? "Connect nose gear" : `Align ${hud.connectDistance == null ? "--" : hud.connectDistance.toFixed(1)} m`}</button>}
          <button className="rr-secondary" onClick={reset}>Reset</button>
          <button className={gyro ? "rr-mini active" : "rr-mini"} onClick={toggleGyro}>Gyro</button>
        </div>
      </section>

      <aside className="rr-metrics">
        <span>Speed <b>{(hud.speed * 2.237).toFixed(1)} mph</b></span>
        <span>Stop <b>{Math.max(0, hud.distance).toFixed(1)} m</b></span>
        <span>Capture <b>{hud.connected ? "Done" : stageIndex === 1 && hud.connectDistance != null ? `${hud.connectDistance.toFixed(1)} m` : "--"}</b></span>
        <span>Nose <b>{hud.connected ? "Captured" : "Free"}</b></span>
      </aside>

      <aside className="rr-guidance">{hud.warning}</aside>

      <div className="rr-steer">
        <button onPointerDown={() => { driveRef.current.steer = 1; }} onPointerUp={() => { driveRef.current.steer = 0; }} onPointerLeave={() => { driveRef.current.steer = 0; }} onPointerCancel={() => { driveRef.current.steer = 0; }}>◀</button>
        <button onPointerDown={() => { driveRef.current.brake = true; }} onPointerUp={() => { driveRef.current.brake = false; }} onPointerLeave={() => { driveRef.current.brake = false; }} onPointerCancel={() => { driveRef.current.brake = false; }}>Brake</button>
        <button onPointerDown={() => { driveRef.current.steer = -1; }} onPointerUp={() => { driveRef.current.steer = 0; }} onPointerLeave={() => { driveRef.current.steer = 0; }} onPointerCancel={() => { driveRef.current.steer = 0; }}>▶</button>
      </div>

      <div className="rr-throttle">
        <button className="rr-direction" onClick={toggleDirection}>{direction}</button>
        <div className="rr-custom-slider" role="slider" aria-label="Throttle" aria-valuemin="0" aria-valuemax="100" aria-valuenow={throttle} onPointerDown={beginThrottleDrag} onPointerMove={moveThrottleDrag} onPointerUp={endThrottleDrag} onPointerCancel={endThrottleDrag} onPointerLeave={endThrottleDrag}>
          <div className="rr-custom-fill" style={{ height: `${throttle}%` }} />
          <div className="rr-custom-thumb" style={{ bottom: `calc(${throttle}% - 13px)` }} />
        </div>
        <div className="rr-throttle-label">Power {throttle}%</div>
      </div>
      {finalScore !== null && <div className="rr-score rr-score-float">Score: {finalScore}</div>}
    </div>
  );
}
