import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

const STAGES = [
  { key: "inspect", label: "Complete visual equipment check", cta: "Confirm equipment ready" },
  { key: "connect", label: "Drive up and secure the nose gear in the cradle", cta: null },
  { key: "clearance", label: "Request pushback clearance", cta: "Request clearance" },
  { key: "brakes", label: "Confirm parking brake released", cta: "Confirm brake released" },
  { key: "push", label: "Push aircraft back on centerline and stop at the stop line", cta: null },
  { key: "disconnect", label: "Lower cradle and release the nose gear", cta: "Release nose gear" },
  { key: "complete", label: "Scenario complete", cta: null },
];

const CRADLE_OFFSET = 2.84;
const NOSE_START_Z = 8;
const STOP_Z = 62;
const CONNECT_DIST_TOL = 0.9;
const CONNECT_ANGLE_TOL = 0.26;
const CONNECT_SPEED_TOL = 0.45;
const CENTERLINE_TOLERANCE = 3;
const RECOMMENDED_MAX_SPEED = 1.6;
const MAX_FREE_SPEED = 4;
const MAX_TOW_SPEED = 1.8;
const MAX_STEER = 0.52;

const CAMERA_DEFAULTS = {
  chase: { yaw: 0, pitch: -0.22, distance: 15, height: 5.2 },
  driver: { yaw: 0, pitch: -0.08, distance: 0, height: 1.35 },
  overhead: { yaw: 0, pitch: -1.18, distance: 40, height: 38 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function shortestAngle(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.58,
    metalness: options.metalness ?? 0.04,
  });
}

function makeBox(w, h, d, color, pos, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMaterial(color, options));
  mesh.position.set(...pos);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCylinder(radius, depth, color, pos, rot = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 24), makeMaterial(color, { roughness: 0.78 }));
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildTug() {
  const group = new THREE.Group();
  const red = 0xc41e1e;
  const yellow = 0xffcc00;
  const dark = 0x17191f;
  const steel = 0xb8c0c8;

  group.add(makeBox(2.05, 0.32, 5.28, red, [0, 0.35, 0], { metalness: 0.18 }));
  group.add(makeBox(1.9, 0.18, 5.0, dark, [0, 0.15, 0]));
  group.add(makeBox(1.35, 0.12, 1.0, dark, [0, 0.46, CRADLE_OFFSET]));

  [-1, 1].forEach((side) => {
    group.add(makeBox(0.15, 0.5, 1.0, yellow, [side * 0.72, 0.68, CRADLE_OFFSET], { rotation: [0, 0, side * -0.16] }));
    group.add(makeBox(0.05, 0.45, 0.9, steel, [side * 0.45, 0.55, CRADLE_OFFSET - 0.65], { rotation: [0.8, 0, 0] }));
  });

  group.add(makeBox(0.9, 0.55, 0.9, red, [0, 0.7, -1.45]));
  group.add(makeBox(0.7, 0.12, 0.3, dark, [0, 1.0, -1.1]));
  group.add(makeBox(0.5, 0.14, 0.5, 0x2a2d34, [0, 0.95, -1.72]));
  group.add(makeBox(0.5, 0.55, 0.12, 0x2a2d34, [0, 1.22, -1.98], { rotation: [-0.18, 0, 0] }));
  group.add(makeCylinder(0.17, 0.035, dark, [0, 1.32, -0.86], [Math.PI / 2.3, 0, 0]));
  group.add(makeBox(1.0, 0.05, 0.6, yellow, [0, 2.02, -1.95]));
  [-0.44, 0.44].forEach((x) => group.add(makeCylinder(0.035, 1.05, yellow, [x, 1.5, -1.95])));

  const wheels = [];
  [-1.08, 1.08].forEach((x) => {
    const wheel = makeCylinder(0.44, 0.36, 0x101114, [x, 0.44, 0.25], [0, 0, Math.PI / 2]);
    wheels.push(wheel);
    group.add(wheel);
    group.add(makeCylinder(0.18, 0.39, steel, [x, 0.44, 0.25], [0, 0, Math.PI / 2]));
  });

  [[-0.72, -1.85], [0.72, -1.85], [-0.72, 2.05], [0.72, 2.05]].forEach(([x, z]) => {
    const wheel = makeCylinder(0.23, 0.2, 0x101114, [x, 0.25, z], [0, 0, Math.PI / 2]);
    wheels.push(wheel);
    group.add(wheel);
  });

  group.add(makeBox(1.4, 0.12, 0.1, dark, [0, 0.55, -2.62]));
  [-0.5, 0.5].forEach((x) => group.add(makeCylinder(0.07, 0.06, 0xff3b30, [x, 0.55, -2.69], [Math.PI / 2, 0, 0])));
  group.add(makeCylinder(0.09, 0.1, 0xff9500, [0, 2.12, 1.95]));

  return { group, wheels };
}

function buildAircraft() {
  const group = new THREE.Group();
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.35, 25, 12, 24), makeMaterial(0xf1f4f7, { roughness: 0.36, metalness: 0.06 }));
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 2.1, -10);
  fuselage.castShadow = true;
  group.add(fuselage);

  group.add(makeBox(22, 0.16, 3.0, 0xf5f7fa, [0, 2.15, -10]));
  group.add(makeBox(8.5, 0.14, 2.0, 0xf5f7fa, [0, 5.1, -24.5]));
  group.add(makeBox(0.18, 4.2, 3.0, 0xf5f7fa, [0, 3.9, -25.2]));
  group.add(makeBox(1.0, 0.7, 2.0, 0x20242b, [-1.85, 2.1, -21]));
  group.add(makeBox(1.0, 0.7, 2.0, 0x20242b, [1.85, 2.1, -21]));
  group.add(makeBox(0.08, 0.12, 21.5, 0x1d4e89, [0, 2.75, -10.2]));

  const noseGear = new THREE.Group();
  noseGear.add(makeCylinder(0.08, 1.0, 0x555b65, [0, 0.8, 0]));
  noseGear.add(makeCylinder(0.22, 0.16, 0x111214, [-0.16, 0.25, 0.25], [0, 0, Math.PI / 2]));
  noseGear.add(makeCylinder(0.22, 0.16, 0x111214, [0.16, 0.25, 0.25], [0, 0, Math.PI / 2]));
  group.add(noseGear);
  return group;
}

function buildRamp(scene) {
  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(120, 160), makeMaterial(0x3b3f46, { roughness: 0.92 }));
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.z = 38;
  ramp.receiveShadow = true;
  scene.add(ramp);

  scene.add(makeBox(85, 7, 1.2, 0x2a2e36, [0, 3.5, -7]));
  scene.add(makeBox(18, 4, 6, 0x343944, [-8, 4.2, -2]));
  scene.add(makeBox(7, 2.8, 22, 0x4a505c, [-8, 4, 9]));
  scene.add(makeBox(5, 1, 9, 0x4a505c, [-8, 2.2, 23]));

  const center = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 96), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
  center.rotation.x = -Math.PI / 2;
  center.position.set(0, 0.015, 40);
  scene.add(center);

  const stop = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.32), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
  stop.rotation.x = -Math.PI / 2;
  stop.position.set(0, 0.02, STOP_Z);
  scene.add(stop);

  for (let z = 0; z < 100; z += 12) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(-5, 0.018, z);
    scene.add(dash);
  }
}

function calcScore(metrics) {
  let score = 100;
  score -= Math.min(25, metrics.centerlinePenalty * 1.8);
  score -= Math.min(25, metrics.speedingPenalty * 4.5);
  score -= Math.min(20, metrics.bumpEvents * 10);
  score -= metrics.missedStop ? 20 : 0;
  return clamp(Math.round(score), 0, 100);
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((mat) => mat.dispose());
      else child.material.dispose();
    }
  });
}

function WebGLFallback({ error }) {
  return (
    <div className="fallbackPanel">
      <div className="eyebrow">RampReady</div>
      <h1>Trainer loading issue</h1>
      <p>The app opened, but the 3D scene did not start cleanly.</p>
      {error && <code>{error}</code>}
    </div>
  );
}

export default function PushbackTrainer() {
  const mountRef = useRef(null);
  const simRef = useRef(null);
  const cameraModeRef = useRef("chase");
  const cameraLookRef = useRef({ ...CAMERA_DEFAULTS.chase, manualYaw: 0, manualPitch: 0, gyroYaw: 0, gyroPitch: 0 });
  const pointerRef = useRef({ active: false, x: 0, y: 0 });
  const keysRef = useRef(new Set());
  const touchRef = useRef({ throttle: 0, steer: 0, brake: false });
  const [stageIndex, setStageIndex] = useState(0);
  const stageIndexRef = useRef(0);
  const [hud, setHud] = useState({ speed: 0, offset: 0, distanceToStop: STOP_Z - NOSE_START_Z, connected: false, warning: "" });
  const [cameraMode, setCameraModeState] = useState("chase");
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const gyroEnabledRef = useRef(false);
  const [score, setScore] = useState(null);
  const [message, setMessage] = useState("Drag anywhere on the 3D view to look around. Use Gyro Look for phone/headset testing.");
  const [bootError, setBootError] = useState("");

  const stage = STAGES[stageIndex] ?? STAGES[STAGES.length - 1];

  const setCameraMode = useCallback((mode) => {
    cameraModeRef.current = mode;
    cameraLookRef.current = { ...CAMERA_DEFAULTS[mode], manualYaw: 0, manualPitch: 0, gyroYaw: 0, gyroPitch: 0 };
    setCameraModeState(mode);
  }, []);

  const toggleGyro = useCallback(async () => {
    const next = !gyroEnabledRef.current;
    if (next && typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") {
          setMessage("Gyro permission was not granted. Drag look still works.");
          return;
        }
      } catch {
        setMessage("Gyro permission failed. Drag look still works.");
        return;
      }
    }
    gyroEnabledRef.current = next;
    setGyroEnabled(next);
    setMessage(next ? "Gyro Look enabled. Move the phone/headset to look around." : "Gyro Look off. Drag on the scene to look around.");
  }, []);

  const advanceStage = useCallback(() => {
    setStageIndex((idx) => {
      const next = clamp(idx + 1, 0, STAGES.length - 1);
      stageIndexRef.current = next;
      return next;
    });
  }, []);

  const resetScenario = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.tug.position.set(0, 0, 0);
    sim.tug.rotation.y = 0;
    sim.aircraft.position.set(0, 0, NOSE_START_Z);
    sim.aircraft.rotation.y = 0;
    sim.velocity = 0;
    sim.steer = 0;
    sim.connected = false;
    sim.metrics = { centerlinePenalty: 0, speedingPenalty: 0, bumpEvents: 0, missedStop: false };
    keysRef.current.clear();
    touchRef.current = { throttle: 0, steer: 0, brake: false };
    stageIndexRef.current = 0;
    setStageIndex(0);
    setScore(null);
    setMessage("Scenario reset. Drag the 3D view to look around, then start the equipment check.");
  }, []);

  useEffect(() => { stageIndexRef.current = stageIndex; }, [stageIndex]);

  useEffect(() => {
    const onOrientation = (event) => {
      if (!gyroEnabledRef.current) return;
      const gamma = event.gamma ?? 0;
      const beta = event.beta ?? 0;
      cameraLookRef.current.gyroYaw = clamp(gamma / 45, -1, 1) * 0.9;
      cameraLookRef.current.gyroPitch = clamp((beta - 55) / 55, -1, 1) * 0.45;
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
      const look = cameraLookRef.current;
      look.manualYaw += dx * 0.006;
      look.manualPitch = clamp(look.manualPitch + dy * 0.004, -0.7, 0.7);
    };
    const onPointerUp = () => { pointerRef.current.active = false; };

    try {
      const width = Math.max(1, mount.clientWidth || window.innerWidth || 1);
      const height = Math.max(1, mount.clientHeight || window.innerHeight || 1);
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.shadowMap.enabled = true;
      renderer.domElement.className = "trainerCanvas";
      mount.replaceChildren(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x99b7d7);
      scene.fog = new THREE.Fog(0x99b7d7, 55, 135);
      const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 500);
      camera.position.set(0, 7, -15);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x4b5563, 1.35));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(18, 35, 14);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      scene.add(sun);

      buildRamp(scene);
      const { group: tug, wheels } = buildTug();
      scene.add(tug);
      const aircraft = buildAircraft();
      aircraft.position.set(0, 0, NOSE_START_Z);
      scene.add(aircraft);

      const sim = { camera, renderer, scene, tug, wheels, aircraft, velocity: 0, steer: 0, connected: false, lastTime: performance.now(), metrics: { centerlinePenalty: 0, speedingPenalty: 0, bumpEvents: 0, missedStop: false } };
      simRef.current = sim;
      setBootError("");

      mount.addEventListener("pointerdown", onPointerDown, { passive: false });
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerUp);

      const onResize = () => {
        const nextWidth = Math.max(1, mount.clientWidth || window.innerWidth || 1);
        const nextHeight = Math.max(1, mount.clientHeight || window.innerHeight || 1);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(nextWidth, nextHeight, false);
      };
      window.addEventListener("resize", onResize);

      const tick = (now) => {
        const dt = Math.min(0.04, (now - sim.lastTime) / 1000 || 0.016);
        sim.lastTime = now;

        const keys = keysRef.current;
        const touch = touchRef.current;
        let throttle = touch.throttle;
        let steerInput = touch.steer;
        const brake = touch.brake || keys.has(" ");
        if (keys.has("w") || keys.has("arrowup")) throttle += 1;
        if (keys.has("s") || keys.has("arrowdown")) throttle -= 1;
        if (keys.has("a") || keys.has("arrowleft")) steerInput += 1;
        if (keys.has("d") || keys.has("arrowright")) steerInput -= 1;
        throttle = clamp(throttle, -1, 1);
        steerInput = clamp(steerInput, -1, 1);

        sim.steer = lerp(sim.steer, steerInput * MAX_STEER, 1 - Math.exp(-5 * dt));
        const maxSpeed = sim.connected ? MAX_TOW_SPEED : MAX_FREE_SPEED;
        const accel = sim.connected ? 0.45 : 1.7;
        const drag = sim.connected ? 0.3 : 1.0;
        const brakeDecel = sim.connected ? 1.5 : 3.2;
        sim.velocity += throttle * accel * dt;
        if (brake) sim.velocity -= Math.sign(sim.velocity) * brakeDecel * dt;
        else sim.velocity -= Math.sign(sim.velocity) * Math.min(Math.abs(sim.velocity), drag * dt);
        sim.velocity = clamp(sim.velocity, -maxSpeed * 0.55, maxSpeed);
        if (Math.abs(sim.velocity) < 0.02) sim.velocity = 0;

        sim.tug.rotation.y += (sim.velocity / 2.34) * Math.tan(sim.steer) * dt;
        sim.tug.position.x += Math.sin(sim.tug.rotation.y) * sim.velocity * dt;
        sim.tug.position.z += Math.cos(sim.tug.rotation.y) * sim.velocity * dt;
        sim.tug.position.z = clamp(sim.tug.position.z, -1, 85);
        sim.tug.updateMatrixWorld(true);
        sim.wheels.forEach((wheel) => { wheel.rotation.x += sim.velocity * dt * 4; });

        const cradleWorld = new THREE.Vector3(0, 0, CRADLE_OFFSET).applyMatrix4(sim.tug.matrixWorld);
        const dist = cradleWorld.distanceTo(sim.aircraft.position);
        const angleError = Math.abs(shortestAngle(sim.tug.rotation.y, sim.aircraft.rotation.y));

        if (!sim.connected && stageIndexRef.current === 1 && dist < CONNECT_DIST_TOL && angleError < CONNECT_ANGLE_TOL && Math.abs(sim.velocity) < CONNECT_SPEED_TOL) {
          sim.connected = true;
          sim.velocity = 0;
          setMessage("Nose gear secured. Request pushback clearance.");
          stageIndexRef.current = 2;
          setStageIndex(2);
        }

        if (sim.connected) {
          sim.aircraft.position.x = cradleWorld.x;
          sim.aircraft.position.z = cradleWorld.z;
          sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.6 * dt));
        }

        const noseX = sim.aircraft.position.x;
        const noseZ = sim.aircraft.position.z;
        const offset = Math.abs(noseX);
        if (sim.connected && stageIndexRef.current === 4) {
          if (offset > CENTERLINE_TOLERANCE) sim.metrics.centerlinePenalty += (offset - CENTERLINE_TOLERANCE) * dt;
          if (Math.abs(sim.velocity) > RECOMMENDED_MAX_SPEED) sim.metrics.speedingPenalty += (Math.abs(sim.velocity) - RECOMMENDED_MAX_SPEED) * dt;
          if (noseZ > STOP_Z + 2) sim.metrics.missedStop = true;
          if (noseZ >= STOP_Z - 0.55 && Math.abs(sim.velocity) < 0.12) {
            sim.velocity = 0;
            setMessage("Good stop. Parking brake set. Release the nose gear.");
            stageIndexRef.current = 5;
            setStageIndex(5);
          }
        }

        let warning = "";
        if (stageIndexRef.current === 1 && dist < 2.4 && Math.abs(sim.velocity) > CONNECT_SPEED_TOL) warning = "Slow down before capturing the nose gear.";
        else if (sim.connected && offset > CENTERLINE_TOLERANCE) warning = "Correct back toward the centerline.";
        else if (sim.connected && Math.abs(sim.velocity) > RECOMMENDED_MAX_SPEED) warning = "Reduce speed — loaded tug limit.";
        else if (stageIndexRef.current === 4 && noseZ > STOP_Z + 1) warning = "You passed the stop line.";

        const look = cameraLookRef.current;
        const target = new THREE.Vector3(sim.connected ? sim.aircraft.position.x : sim.tug.position.x, 1.35, sim.connected ? sim.aircraft.position.z : sim.tug.position.z + 4);
        const totalYaw = sim.tug.rotation.y + look.yaw + look.manualYaw + look.gyroYaw;
        const totalPitch = look.pitch + look.manualPitch + look.gyroPitch;

        if (cameraModeRef.current === "driver") {
          const eye = new THREE.Vector3(0, 1.45, -1.15).applyMatrix4(sim.tug.matrixWorld);
          const forward = new THREE.Vector3(Math.sin(totalYaw), Math.sin(-totalPitch) * 0.65, Math.cos(totalYaw));
          camera.position.lerp(eye, 0.35);
          camera.lookAt(eye.clone().add(forward.multiplyScalar(20)));
        } else if (cameraModeRef.current === "overhead") {
          const orbit = new THREE.Vector3(Math.sin(totalYaw) * 8, look.height, Math.cos(totalYaw) * 8);
          camera.position.lerp(target.clone().add(orbit), 0.12);
          camera.lookAt(target.x, 0, target.z + 8);
        } else {
          const orbit = new THREE.Vector3(
            Math.sin(totalYaw) * look.distance,
            look.height + Math.sin(-totalPitch) * 8,
            -Math.cos(totalYaw) * look.distance
          );
          camera.position.lerp(target.clone().add(orbit), 0.12);
          camera.lookAt(target.x, target.y + 1, target.z + 5);
        }

        setHud({ speed: Math.abs(sim.velocity), offset, distanceToStop: STOP_Z - noseZ, connected: sim.connected, warning });
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
        disposeObject(scene);
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        simRef.current = null;
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("RampReady boot error", error);
      setBootError(msg);
      return undefined;
    }
  }, []);

  useEffect(() => {
    const prevent = new Set([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
    const down = (event) => {
      if (prevent.has(event.key)) event.preventDefault();
      keysRef.current.add(event.key.toLowerCase());
    };
    const up = (event) => {
      if (prevent.has(event.key)) event.preventDefault();
      keysRef.current.delete(event.key.toLowerCase());
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up, { passive: false });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const handleCta = () => {
    if (stage.key === "inspect") setMessage("Inspection complete. Approach the nose gear slowly and squarely.");
    if (stage.key === "clearance") setMessage("Pushback clearance received. Confirm brake release.");
    if (stage.key === "brakes") setMessage("Parking brake released. Begin pushback slowly and hold the centerline.");
    if (stage.key === "disconnect") {
      const sim = simRef.current;
      if (sim) {
        sim.connected = false;
        sim.velocity = 0;
        const finalScore = calcScore(sim.metrics);
        setScore(finalScore);
        setMessage(finalScore >= 85 ? "RampReady pass. Smooth, controlled pushback." : "Scenario complete. Review the notes and run it again.");
      }
    }
    advanceStage();
  };

  const touch = {
    forwardDown: () => { touchRef.current.throttle = 1; },
    reverseDown: () => { touchRef.current.throttle = -1; },
    throttleUp: () => { touchRef.current.throttle = 0; },
    leftDown: () => { touchRef.current.steer = 1; },
    rightDown: () => { touchRef.current.steer = -1; },
    steerUp: () => { touchRef.current.steer = 0; },
    brakeDown: () => { touchRef.current.brake = true; },
    brakeUp: () => { touchRef.current.brake = false; },
  };

  return (
    <div className="trainerShell">
      <div ref={mountRef} className="sceneMount" />
      {bootError && <WebGLFallback error={bootError} />}

      <section className="topHud compactHud">
        <div>
          <div className="eyebrow">RampReady</div>
          <h1>CRJ700 Pushback Trainer</h1>
          <p>{message}</p>
        </div>
        <div className="cameraButtons">
          {["chase", "driver", "overhead"].map((mode) => (
            <button key={mode} className={cameraMode === mode ? "active" : ""} onClick={() => setCameraMode(mode)}>{mode}</button>
          ))}
          <button className={gyroEnabled ? "active" : ""} onClick={toggleGyro}>Gyro Look</button>
        </div>
      </section>

      <aside className="stagePanel">
        <div className="stageHeader">Step {Math.min(stageIndex + 1, STAGES.length)} / {STAGES.length}</div>
        <h2>{stage.label}</h2>
        {stage.cta && <button className="primary" onClick={handleCta}>{stage.cta}</button>}
        <button className="secondary" onClick={resetScenario}>Reset scenario</button>
        {score !== null && <div className="score">Score: {score}</div>}
      </aside>

      <aside className="metricsPanel">
        <div><span>Speed</span><strong>{(hud.speed * 2.237).toFixed(1)} mph</strong></div>
        <div><span>Centerline</span><strong>{hud.offset.toFixed(1)} m</strong></div>
        <div><span>Stop line</span><strong>{hud.distanceToStop.toFixed(1)} m</strong></div>
        <div><span>Nose gear</span><strong>{hud.connected ? "secured" : "free"}</strong></div>
        {hud.warning && <div className="warning">{hud.warning}</div>}
      </aside>

      <div className="touchControls" aria-label="Touch driving controls">
        <button onPointerDown={touch.leftDown} onPointerUp={touch.steerUp} onPointerCancel={touch.steerUp}>◀</button>
        <button onPointerDown={touch.forwardDown} onPointerUp={touch.throttleUp} onPointerCancel={touch.throttleUp}>▲</button>
        <button onPointerDown={touch.brakeDown} onPointerUp={touch.brakeUp} onPointerCancel={touch.brakeUp}>Brake</button>
        <button onPointerDown={touch.reverseDown} onPointerUp={touch.throttleUp} onPointerCancel={touch.throttleUp}>▼</button>
        <button onPointerDown={touch.rightDown} onPointerUp={touch.steerUp} onPointerCancel={touch.steerUp}>▶</button>
      </div>
    </div>
  );
}
