import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const TUG_HALF_LENGTH = 2.64;
const CRADLE_OFFSET = TUG_HALF_LENGTH + 0.2;
const NOSE_START_Z = 8;
const STOP_Z = 62;
const CONNECT_DIST_TOL = 0.8;
const CONNECT_ANGLE_TOL = 0.22;
const CONNECT_SPEED_TOL = 0.4;
const CENTERLINE_TOLERANCE = 3;
const RECOMMENDED_MAX_SPEED = 1.6;
const MAX_FREE_SPEED = 4;
const MAX_TOW_SPEED = 1.8;
const MAX_STEER = 0.52;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function makeBox(w, h, d, color, pos, options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? 0.55, metalness: options.metalness ?? 0.05 })
  );
  mesh.position.set(...pos);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCylinder(radius, depth, color, pos, rot = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, 24),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
  );
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

  group.add(makeBox(2.05, 0.32, 5.28, red, [0, 0.35, 0], { metalness: 0.2 }));
  group.add(makeBox(1.9, 0.18, 5.0, dark, [0, 0.15, 0]));

  const cradleZ = CRADLE_OFFSET;
  group.add(makeBox(1.35, 0.12, 1.0, dark, [0, 0.46, cradleZ]));
  [-1, 1].forEach((side) => {
    group.add(makeBox(0.15, 0.5, 1.0, yellow, [side * 0.72, 0.68, cradleZ], { rotation: [0, 0, side * -0.16] }));
    group.add(makeBox(0.05, 0.45, 0.9, steel, [side * 0.45, 0.55, cradleZ - 0.65], { rotation: [0.8, 0, 0] }));
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
  const fuselageMat = new THREE.MeshStandardMaterial({ color: 0xf1f4f7, roughness: 0.35, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.7 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4e89, roughness: 0.45 });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.35, 25, 12, 24), fuselageMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 2.1, -10);
  fuselage.castShadow = true;
  group.add(fuselage);

  group.add(makeBox(22, 0.16, 3.0, 0xf5f7fa, [0, 2.15, -10]));
  group.add(makeBox(8.5, 0.14, 2.0, 0xf5f7fa, [0, 5.1, -24.5]));
  group.add(makeBox(0.18, 4.2, 3.0, 0xf5f7fa, [0, 3.9, -25.2]));
  group.add(makeBox(1.0, 0.7, 2.0, darkMat.color.getHex(), [-1.85, 2.1, -21]));
  group.add(makeBox(1.0, 0.7, 2.0, darkMat.color.getHex(), [1.85, 2.1, -21]));
  group.add(makeBox(0.08, 0.12, 21.5, blueMat.color.getHex(), [0, 2.75, -10.2]));

  const noseGear = new THREE.Group();
  noseGear.add(makeCylinder(0.08, 1.0, 0x555b65, [0, 0.8, 0]));
  noseGear.add(makeCylinder(0.22, 0.16, 0x111214, [-0.16, 0.25, 0.25], [0, 0, Math.PI / 2]));
  noseGear.add(makeCylinder(0.22, 0.16, 0x111214, [0.16, 0.25, 0.25], [0, 0, Math.PI / 2]));
  group.add(noseGear);

  return group;
}

function buildRamp(scene) {
  const rampMat = new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.9 });
  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(120, 160), rampMat);
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.z = 38;
  ramp.receiveShadow = true;
  scene.add(ramp);

  scene.add(makeBox(85, 7, 1.2, 0x2a2e36, [0, 3.5, -7]));
  scene.add(makeBox(18, 4, 6, 0x343944, [-8, 4.2, -2]));
  scene.add(makeBox(7, 2.8, 22, 0x4a505c, [-8, 4, 9]));
  scene.add(makeBox(5, 1, 9, 0x4a505c, [-8, 2.2, 23]));

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffd400 });
  const center = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 96), lineMat);
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

export default function PushbackTrainer() {
  const mountRef = useRef(null);
  const simRef = useRef(null);
  const keysRef = useRef(new Set());
  const touchRef = useRef({ throttle: 0, steer: 0, brake: false });
  const [stageIndex, setStageIndex] = useState(0);
  const stageIndexRef = useRef(0);
  const [hud, setHud] = useState({ speed: 0, offset: 0, distanceToStop: STOP_Z - NOSE_START_Z, connected: false, warning: "" });
  const [cameraMode, setCameraMode] = useState("chase");
  const [score, setScore] = useState(null);
  const [message, setMessage] = useState("Follow the ramp procedure and keep the nose gear on the centerline.");

  const stage = STAGES[stageIndex];

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
    setMessage("Scenario reset. Start with the visual equipment check.");
  }, []);

  useEffect(() => {
    stageIndexRef.current = stageIndex;
  }, [stageIndex]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x99b7d7);
    scene.fog = new THREE.Fog(0x99b7d7, 45, 120);

    const camera = new THREE.PerspectiveCamera(62, mount.clientWidth / mount.clientHeight, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x4b5563, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(18, 35, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    buildRamp(scene);
    const { group: tug, wheels } = buildTug();
    scene.add(tug);
    const aircraft = buildAircraft();
    aircraft.position.set(0, 0, NOSE_START_Z);
    scene.add(aircraft);

    const sim = {
      scene,
      camera,
      renderer,
      tug,
      wheels,
      aircraft,
      velocity: 0,
      steer: 0,
      connected: false,
      lastTime: performance.now(),
      metrics: { centerlinePenalty: 0, speedingPenalty: 0, bumpEvents: 0, missedStop: false },
    };
    simRef.current = sim;

    const onResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
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

      const targetSteer = steerInput * MAX_STEER;
      sim.steer = lerp(sim.steer, targetSteer, 1 - Math.exp(-5 * dt));

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
      sim.wheels.forEach((wheel) => {
        wheel.rotation.x += sim.velocity * dt * 4;
      });

      const cradleWorld = new THREE.Vector3(0, 0, CRADLE_OFFSET).applyMatrix4(sim.tug.matrixWorld);
      const noseWorld = sim.aircraft.position.clone();
      const dist = cradleWorld.distanceTo(noseWorld);
      const angleError = Math.abs(Math.atan2(Math.sin(sim.tug.rotation.y - sim.aircraft.rotation.y), Math.cos(sim.tug.rotation.y - sim.aircraft.rotation.y)));

      if (!sim.connected && stageIndexRef.current === 1 && dist < CONNECT_DIST_TOL && angleError < CONNECT_ANGLE_TOL && Math.abs(sim.velocity) < CONNECT_SPEED_TOL) {
        sim.connected = true;
        sim.velocity = 0;
        setMessage("Nose gear secured. Request pushback clearance.");
        stageIndexRef.current = 2;
        setStageIndex(2);
      }

      if (sim.connected) {
        // Critical fix from the uploaded prototype: once connected, the aircraft nose tracks the tug cradle.
        // This allows the pushback to actually reach the stop line instead of staying locked at the gate.
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

      const cameraModeNow = cameraMode;
      if (cameraModeNow === "driver") {
        const eye = new THREE.Vector3(0, 1.45, -1.15).applyMatrix4(sim.tug.matrixWorld);
        const look = new THREE.Vector3(0, 1.15, 10).applyMatrix4(sim.tug.matrixWorld);
        camera.position.lerp(eye, 0.35);
        camera.lookAt(look);
      } else if (cameraModeNow === "overhead") {
        camera.position.lerp(new THREE.Vector3(0, 42, sim.aircraft.position.z + 8), 0.08);
        camera.lookAt(sim.aircraft.position.x, 0, sim.aircraft.position.z + 12);
      } else {
        const behind = new THREE.Vector3(0, 5.2, -11).applyMatrix4(sim.tug.matrixWorld);
        camera.position.lerp(behind, 0.12);
        camera.lookAt(new THREE.Vector3(sim.tug.position.x, 0.8, sim.tug.position.z + 5));
      }

      setHud({
        speed: Math.abs(sim.velocity),
        offset,
        distanceToStop: STOP_Z - noseZ,
        connected: sim.connected,
        warning,
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      simRef.current = null;
    };
  }, [cameraMode]);

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

  const controlHandlers = useMemo(() => ({
    forwardDown: () => { touchRef.current.throttle = 1; },
    reverseDown: () => { touchRef.current.throttle = -1; },
    throttleUp: () => { touchRef.current.throttle = 0; },
    leftDown: () => { touchRef.current.steer = 1; },
    rightDown: () => { touchRef.current.steer = -1; },
    steerUp: () => { touchRef.current.steer = 0; },
    brakeDown: () => { touchRef.current.brake = true; },
    brakeUp: () => { touchRef.current.brake = false; },
  }), []);

  return (
    <div className="trainerShell">
      <div ref={mountRef} className="sceneMount" />

      <section className="topHud">
        <div>
          <div className="eyebrow">RampReady</div>
          <h1>CRJ700 Pushback Trainer</h1>
          <p>{message}</p>
        </div>
        <div className="cameraButtons">
          {["chase", "driver", "overhead"].map((mode) => (
            <button key={mode} className={cameraMode === mode ? "active" : ""} onClick={() => setCameraMode(mode)}>{mode}</button>
          ))}
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
        <button onPointerDown={controlHandlers.leftDown} onPointerUp={controlHandlers.steerUp} onPointerCancel={controlHandlers.steerUp}>◀</button>
        <button onPointerDown={controlHandlers.forwardDown} onPointerUp={controlHandlers.throttleUp} onPointerCancel={controlHandlers.throttleUp}>▲</button>
        <button onPointerDown={controlHandlers.brakeDown} onPointerUp={controlHandlers.brakeUp} onPointerCancel={controlHandlers.brakeUp}>Brake</button>
        <button onPointerDown={controlHandlers.reverseDown} onPointerUp={controlHandlers.throttleUp} onPointerCancel={controlHandlers.throttleUp}>▼</button>
        <button onPointerDown={controlHandlers.rightDown} onPointerUp={controlHandlers.steerUp} onPointerCancel={controlHandlers.steerUp}>▶</button>
      </div>
    </div>
  );
}
