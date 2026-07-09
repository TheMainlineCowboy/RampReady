import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildCRJ700Aircraft } from "./aircraft/crj700Model.js";
import "./RampReadyTrainer.css";

const STAGES = [
  "Complete visual equipment check",
  "Drive straight ahead and align with the nose gear",
  "Request pushback clearance",
  "Confirm aircraft parking brake released",
  "Push back on centerline and stop at the red line",
  "Lower cradle and release the nose gear",
  "Scenario complete",
];

const NOSE_START_Z = 6.2;
const STOP_Z = 52;
const CRADLE_Z = 3.45;
const CONNECT_DISTANCE = 1.05;
const CONNECT_SPEED_LIMIT = 0.65;
const MAX_FREE_SPEED = 3.2;
const MAX_TOW_SPEED = 1.25;
const MAX_STEER = 0.42;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;

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

function buildGround(scene) {
  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(90, 120), mat(0x50545a, 0.95, 0.02));
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.z = 28;
  ramp.receiveShadow = true;
  scene.add(ramp);

  const center = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 86), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
  center.rotation.x = -Math.PI / 2;
  center.position.set(0, 0.018, 28);
  scene.add(center);

  const stop = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.32), new THREE.MeshBasicMaterial({ color: 0xff3434 }));
  stop.rotation.x = -Math.PI / 2;
  stop.position.set(0, 0.022, STOP_Z);
  scene.add(stop);
}

function buildTug() {
  const group = new THREE.Group();
  const wheels = [];
  const red = 0xb42324;
  const black = 0x111318;
  const deck = 0x20242b;
  const yellow = 0xffcc00;

  group.add(box(2.35, 0.42, 5.5, red, 0, 0.55, -0.15));
  group.add(box(2.08, 0.11, 4.95, deck, 0, 0.82, -0.2));
  group.add(box(2.15, 0.42, 0.92, 0x801516, 0, 0.64, -2.42));
  group.add(box(1.42, 0.32, 1.22, red, 0, 0.92, -1.43));
  group.add(box(0.52, 0.4, 0.4, 0xd8d2c8, -0.48, 1.08, -2.1, 0.12));
  group.add(box(0.52, 0.4, 0.4, 0xd8d2c8, 0.48, 1.08, -2.1, 0.12));
  group.add(cyl(0.22, 0.045, black, -0.54, 1.26, -1.44, Math.PI / 2.2, 0, 0, 36));
  group.add(cyl(0.09, 0.12, 0xff9900, 0, 1.35, -1.88));

  // Short integrated towbarless cradle, directly attached to the tug nose.
  group.add(box(1.8, 0.1, 0.95, black, 0, 0.22, 2.75, -0.08));
  group.add(box(1.7, 0.12, 0.9, black, 0, 0.34, CRADLE_Z));
  group.add(box(2.05, 0.08, 0.62, black, 0, 0.12, CRADLE_Z + 0.48, -0.16));
  [-1, 1].forEach((s) => {
    group.add(box(0.16, 0.56, 0.85, yellow, s * 0.62, 0.55, CRADLE_Z, 0, 0, -s * 0.14));
    group.add(box(0.12, 0.42, 0.62, black, s * 0.9, 0.42, CRADLE_Z + 0.08));
  });

  [-1, 1].forEach((s) => {
    const rear = cyl(0.55, 0.42, 0x0c0d0f, s * 1.14, 0.48, -1.65, 0, 0, Math.PI / 2, 40);
    const front = cyl(0.5, 0.38, 0x0c0d0f, s * 1.12, 0.47, 1.95, 0, 0, Math.PI / 2, 40);
    wheels.push(rear, front);
    group.add(rear, front);
    group.add(cyl(0.25, 0.43, 0xaeb4bc, s * 1.15, 0.48, -1.65, 0, 0, Math.PI / 2, 36));
    group.add(cyl(0.23, 0.39, 0xaeb4bc, s * 1.13, 0.47, 1.95, 0, 0, Math.PI / 2, 36));
  });

  return { group, wheels };
}

function dispose(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) Array.isArray(child.material) ? child.material.forEach((m) => m.dispose()) : child.material.dispose();
  });
}

export default function RampReadyTrainerStable() {
  const mountRef = useRef(null);
  const simRef = useRef(null);
  const stageRef = useRef(0);
  const cameraModeRef = useRef("chase");
  const messageRef = useRef("Use low power to approach. Watch capture distance, then connect nose gear.");
  const driveRef = useRef({ throttle: 0, steer: 0, brake: false, direction: 1 });
  const keysRef = useRef(new Set());
  const dragThrottleRef = useRef(false);
  const camRef = useRef({ yaw: 0, pitch: 0.02, distance: 13, height: 4.2 });

  const [stageIndex, setStageIndex] = useState(0);
  const [cameraMode, setCameraMode] = useState("chase");
  const [direction, setDirection] = useState("FWD");
  const [throttle, setThrottle] = useState(0);
  const [message, setMessage] = useState(messageRef.current);
  const [hud, setHud] = useState({ speed: 0, stop: STOP_Z - NOSE_START_Z, capture: 0, ready: false, connected: false, debug: "" });

  const setTrainerMessage = useCallback((value) => {
    messageRef.current = value;
    setMessage(value);
  }, []);

  const setThrottleValue = useCallback((value) => {
    const next = clamp(Math.round(value), 0, 100);
    driveRef.current.throttle = next / 100;
    setThrottle(next);
  }, []);

  const updateThrottleFromPointer = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    setThrottleValue((1 - y / rect.height) * 100);
    event.preventDefault();
  }, [setThrottleValue]);

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
    driveRef.current = { throttle: 0, steer: 0, brake: false, direction: 1 };
    stageRef.current = 0;
    setStageIndex(0);
    setThrottle(0);
    setDirection("FWD");
    setTrainerMessage("Use low power to approach. Watch capture distance, then connect nose gear.");
  }, [setTrainerMessage]);

  const connectNoseGear = useCallback(() => {
    const sim = simRef.current;
    if (!sim || sim.connected || stageRef.current !== 1) return;
    sim.tug.updateMatrixWorld(true);
    const cradle = new THREE.Vector3(0, 0, CRADLE_Z).applyMatrix4(sim.tug.matrixWorld);
    const capture = cradle.distanceTo(sim.aircraft.position);
    if (capture > CONNECT_DISTANCE || Math.abs(sim.velocity) > CONNECT_SPEED_LIMIT) {
      setTrainerMessage(`Align closer and stop before connecting. Capture ${capture.toFixed(1)} m.`);
      return;
    }
    sim.connected = true;
    sim.velocity = 0;
    driveRef.current.throttle = 0;
    setThrottle(0);
    setTrainerMessage("Nose gear connected. Request pushback clearance.");
    stageRef.current = 2;
    setStageIndex(2);
  }, [setTrainerMessage]);

  const releaseNoseGear = useCallback(() => {
    const sim = simRef.current;
    if (!sim || !sim.connected) return;
    sim.connected = false;
    sim.velocity = 0;
    driveRef.current = { throttle: 0, steer: 0, brake: false, direction: 1 };
    setThrottle(0);
    setDirection("FWD");
    setTrainerMessage("Nose gear released. Tug clear. Scenario complete.");
    stageRef.current = 6;
    setStageIndex(6);
  }, [setTrainerMessage]);

  useEffect(() => { stageRef.current = stageIndex; }, [stageIndex]);
  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);

  useEffect(() => {
    let raf = 0;
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    const width = Math.max(1, mount.clientWidth || window.innerWidth || 1);
    const height = Math.max(1, mount.clientHeight || window.innerHeight || 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "trainerCanvas";
    mount.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fc4e6);
    scene.fog = new THREE.Fog(0x9fc4e6, 70, 140);
    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 500);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x58616b, 1.45));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(18, 28, -14);
    sun.castShadow = true;
    scene.add(sun);
    buildGround(scene);

    const { group: tug, wheels } = buildTug();
    const aircraft = buildCRJ700Aircraft(THREE, mat, cyl);
    aircraft.position.set(0, 0, NOSE_START_Z);
    aircraft.scale.set(0.82, 0.82, 0.82);
    scene.add(tug, aircraft);

    const sim = { scene, renderer, camera, tug, wheels, aircraft, velocity: 0, steer: 0, connected: false, last: performance.now() };
    simRef.current = sim;

    const pointer = { active: false, x: 0, y: 0 };
    const pointerDown = (event) => {
      if (event.target !== mount && event.target !== renderer.domElement) return;
      pointer.active = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      event.preventDefault();
    };
    const pointerMove = (event) => {
      if (!pointer.active) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      camRef.current.yaw += dx * 0.006;
      camRef.current.pitch = clamp(camRef.current.pitch - dy * 0.006, -0.55, 0.85);
      event.preventDefault();
    };
    const pointerUp = () => { pointer.active = false; };
    const resize = () => {
      const w = Math.max(1, mount.clientWidth || window.innerWidth || 1);
      const h = Math.max(1, mount.clientHeight || window.innerHeight || 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    mount.addEventListener("pointerdown", pointerDown, { passive: false });
    window.addEventListener("pointermove", pointerMove, { passive: false });
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("resize", resize);

    const tick = (now) => {
      const dt = Math.min(0.04, (now - sim.last) / 1000 || 0.016);
      sim.last = now;
      const drive = driveRef.current;
      let steer = drive.steer;
      if (keysRef.current.has("a") || keysRef.current.has("arrowleft")) steer += 1;
      if (keysRef.current.has("d") || keysRef.current.has("arrowright")) steer -= 1;
      sim.steer = lerp(sim.steer, clamp(steer, -1, 1) * MAX_STEER, 1 - Math.exp(-6 * dt));

      const throttleNorm = drive.throttle;
      const usefulThrottle = throttleNorm > 0.02 ? 0.16 + throttleNorm * 0.84 : 0;
      const connectedPushPhase = sim.connected && stageRef.current >= 4;
      const signedDirection = connectedPushPhase ? (drive.direction === -1 ? 1 : -1) : drive.direction;
      const maxSpeed = sim.connected ? MAX_TOW_SPEED : MAX_FREE_SPEED;
      const targetSpeed = usefulThrottle * signedDirection * maxSpeed;
      sim.velocity = lerp(sim.velocity, targetSpeed, 1 - Math.exp((sim.connected ? -3.4 : -4.4) * dt));
      if (drive.brake || keysRef.current.has(" ")) sim.velocity = lerp(sim.velocity, 0, 1 - Math.exp(-9 * dt));
      if (usefulThrottle === 0) sim.velocity = lerp(sim.velocity, 0, 1 - Math.exp(-1.7 * dt));
      if (Math.abs(sim.velocity) < 0.01) sim.velocity = 0;

      sim.tug.rotation.y += (sim.velocity / 2.35) * Math.tan(sim.steer) * dt;
      sim.tug.position.x += Math.sin(sim.tug.rotation.y) * sim.velocity * dt;
      sim.tug.position.z += Math.cos(sim.tug.rotation.y) * sim.velocity * dt;
      sim.tug.updateMatrixWorld(true);
      sim.wheels.forEach((wheel) => { wheel.rotation.x += sim.velocity * dt * 4; });

      const cradle = new THREE.Vector3(0, 0, CRADLE_Z).applyMatrix4(sim.tug.matrixWorld);
      const capture = cradle.distanceTo(sim.aircraft.position);
      const ready = !sim.connected && stageRef.current === 1 && capture <= CONNECT_DISTANCE && Math.abs(sim.velocity) <= CONNECT_SPEED_LIMIT;

      if (sim.connected) {
        sim.aircraft.position.x = cradle.x;
        sim.aircraft.position.z = cradle.z;
        sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));
      }

      if (sim.connected && stageRef.current === 4 && sim.aircraft.position.z >= STOP_Z - 0.5 && Math.abs(sim.velocity) < 0.18) {
        sim.velocity = 0;
        driveRef.current.throttle = 0;
        setThrottle(0);
        setTrainerMessage("Good stop. Release the nose gear.");
        stageRef.current = 5;
        setStageIndex(5);
      }

      const mode = cameraModeRef.current;
      if (mode === "driver") {
        const eye = new THREE.Vector3(-0.45, 1.35, -2.15).applyMatrix4(sim.tug.matrixWorld);
        const yaw = sim.tug.rotation.y + camRef.current.yaw;
        const forward = new THREE.Vector3(Math.sin(yaw) * Math.cos(camRef.current.pitch), Math.sin(camRef.current.pitch), Math.cos(yaw) * Math.cos(camRef.current.pitch));
        camera.position.lerp(eye, 0.32);
        camera.lookAt(eye.clone().add(forward.multiplyScalar(22)));
      } else if (mode === "overhead") {
        const target = sim.connected ? sim.aircraft.position : cradle;
        camera.position.lerp(new THREE.Vector3(target.x, 34, target.z + 2), 0.16);
        camera.lookAt(target.x, 0, target.z + 5);
      } else {
        const base = new THREE.Vector3(sim.tug.position.x, 1.25, sim.tug.position.z + 2.8);
        const horizontal = Math.cos(camRef.current.pitch) * camRef.current.distance;
        const orbit = new THREE.Vector3(Math.sin(camRef.current.yaw) * horizontal, camRef.current.height + Math.sin(camRef.current.pitch) * camRef.current.distance, -Math.cos(camRef.current.yaw) * horizontal);
        camera.position.lerp(base.clone().add(orbit), 0.12);
        camera.lookAt(base.x, base.y + 0.8, base.z + 2.2);
      }

      let liveMessage = messageRef.current;
      if (stageRef.current === 1) liveMessage = ready ? "Capture distance green. Tap Connect nose gear." : `Capture ${capture.toFixed(1)} m. Approach slowly.`;
      if (stageRef.current === 4 && drive.direction !== -1) liveMessage = "Direction should be REV for pushback.";
      setHud({
        speed: Math.abs(sim.velocity),
        stop: STOP_Z - sim.aircraft.position.z,
        capture,
        ready,
        connected: sim.connected,
        debug: `thr ${Math.round(drive.throttle * 100)} cmd ${targetSpeed.toFixed(2)} vel ${sim.velocity.toFixed(2)} tugZ ${sim.tug.position.z.toFixed(1)} cradleZ ${cradle.z.toFixed(1)} noseZ ${sim.aircraft.position.z.toFixed(1)}`,
      });
      if (liveMessage !== messageRef.current && (stageRef.current === 1 || stageRef.current === 4)) setTrainerMessage(liveMessage);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      mount.removeEventListener("pointerdown", pointerDown);
      dispose(scene);
      renderer.dispose();
      simRef.current = null;
    };
  }, [setTrainerMessage]);

  useEffect(() => {
    const down = (event) => { keysRef.current.add(event.key.toLowerCase()); };
    const up = (event) => { keysRef.current.delete(event.key.toLowerCase()); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const advance = () => {
    if (stageIndex === 0) setTrainerMessage("Approach the nose gear slowly. Stop when capture distance is green.");
    if (stageIndex === 2) setTrainerMessage("Clearance received. Confirm brake release.");
    if (stageIndex === 3) {
      driveRef.current.direction = -1;
      driveRef.current.throttle = 0;
      setDirection("REV");
      setThrottle(0);
      setTrainerMessage("Brake released. REV selected for pushback. Add power slowly.");
    }
    setStageIndex((old) => {
      const next = clamp(old + 1, 0, STAGES.length - 1);
      stageRef.current = next;
      return next;
    });
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
          <select className="rr-view-select" value={cameraMode} onChange={(event) => setCameraMode(event.target.value)}>
            <option value="chase">Chase view</option>
            <option value="driver">Driver view</option>
            <option value="overhead">Overhead view</option>
          </select>
        </div>
        <p>{message}</p>
        <div className="rr-hud-actions">
          {[0, 2, 3].includes(stageIndex) && <button className="rr-primary" onClick={advance}>{stageIndex === 0 ? "Ready" : stageIndex === 2 ? "Clearance" : "Brake released"}</button>}
          {stageIndex === 1 && <button className={hud.ready ? "rr-primary" : "rr-primary rr-disabled"} disabled={!hud.ready} onClick={connectNoseGear}>{hud.ready ? "Connect nose gear" : `Align ${hud.capture == null ? "--" : hud.capture.toFixed(1)} m`}</button>}
          {stageIndex === 5 && <button className="rr-primary" onClick={releaseNoseGear}>Release gear</button>}
          <button className="rr-secondary" onClick={reset}>Reset</button>
        </div>
      </section>

      <aside className="rr-metrics">
        <span>Speed <b>{(hud.speed * 2.237).toFixed(1)} mph</b></span>
        <span>Stop <b>{Math.max(0, hud.stop).toFixed(1)} m</b></span>
        <span>Capture <b>{hud.connected ? "Done" : hud.capture == null ? "--" : `${hud.capture.toFixed(1)} m`}</b></span>
        <span>Nose <b>{hud.connected ? "Captured" : "Free"}</b></span>
      </aside>
      <aside className="rr-diagnostics">{hud.debug}</aside>

      <div className="rr-steer">
        <button onPointerDown={() => { driveRef.current.steer = 1; }} onPointerUp={() => { driveRef.current.steer = 0; }} onPointerCancel={() => { driveRef.current.steer = 0; }}>◀</button>
        <button onPointerDown={() => { driveRef.current.brake = true; }} onPointerUp={() => { driveRef.current.brake = false; }} onPointerCancel={() => { driveRef.current.brake = false; }}>Brake</button>
        <button onPointerDown={() => { driveRef.current.steer = -1; }} onPointerUp={() => { driveRef.current.steer = 0; }} onPointerCancel={() => { driveRef.current.steer = 0; }}>▶</button>
      </div>

      <div className="rr-throttle">
        <button className="rr-direction" onClick={() => {
          const next = driveRef.current.direction === 1 ? -1 : 1;
          driveRef.current.direction = next;
          setDirection(next === 1 ? "FWD" : "REV");
        }}>{direction}</button>
        <div className="rr-custom-slider" role="slider" aria-label="Throttle" aria-valuemin="0" aria-valuemax="100" aria-valuenow={throttle}
          onPointerDown={(event) => { dragThrottleRef.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); updateThrottleFromPointer(event); }}
          onPointerMove={(event) => { if (dragThrottleRef.current) updateThrottleFromPointer(event); }}
          onPointerUp={(event) => { dragThrottleRef.current = false; event.currentTarget.releasePointerCapture?.(event.pointerId); }}
          onPointerCancel={() => { dragThrottleRef.current = false; }}>
          <div className="rr-custom-fill" style={{ height: `${throttle}%` }} />
          <div className="rr-custom-thumb" style={{ bottom: `calc(${throttle}% - 13px)` }} />
        </div>
        <div className="rr-throttle-label">Power {throttle}%</div>
      </div>
    </div>
  );
}
