import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runtimePath = path.join(root, "src/components/RampReadyStandupTrainerTerminal4.jsx");
const jetwayPath = path.join(root, "src/environment/uploadedAirportJetwayFleet.js");
const collisionAuthority = "terminal-jetway-aircraft-raycast-envelope-v45";
const retractionAuthority = "aircraft-door-clearance-without-overtravel-v6";

function prepareCollisionRuntime() {
  const readyAnchor = "    const environment = buildGround(scene);\n";
  const resolvedAnchor = `    void Promise.all([terminalLoad, groundLoad, photoGroundLoad])
      .then(() => {
        renderer.domElement.dataset.environmentSource = environment.userData.environmentSource;`;
  const motionAnchor = `      const state = sim.dynamics;
      rig.root.position.set(state.tugX, 0, state.tugZ);`;

  let source = fs.readFileSync(runtimePath, "utf8");
  if (!source.includes(collisionAuthority)) {
    for (const [name, anchor] of Object.entries({ readyAnchor, resolvedAnchor, motionAnchor })) {
      if (!source.includes(anchor)) throw new Error(`Airport collision guard v45 anchor missing: ${name}`);
    }

    const collisionRuntime = `    const airportCollision = {
      authority: "${collisionAuthority}",
      raycaster: new THREE.Raycaster(),
      direction: new THREE.Vector3(),
      origin: new THREE.Vector3(),
      staticTargets: [],
      aircraftTarget: null,
      ready: false,
      blocked: false,
      count: 0,
      lastMessageAt: 0,
    };
    const collisionHierarchyVisible = (object) => {
      for (let current = object; current; current = current.parent) {
        if (current.visible === false) return false;
      }
      return true;
    };
    const collisionHitEligible = (hit) => {
      if (!hit?.object?.isMesh || !collisionHierarchyVisible(hit.object)) return false;
      const path = [];
      for (let current = hit.object; current; current = current.parent) path.push(current.name || "");
      const identity = path.join("/");
      if (/Ground|Aerial|Pavement|Marking|Projected|Runway|Taxiway|LightHalo|ApronSurface/i.test(identity)) return false;
      if (hit.object.material?.transparent && Number(hit.object.material.opacity) <= 0.05) return false;
      return Number(hit.point?.y) >= 0.18;
    };
    const airportMovementBlocked = ({ startX, startZ, endX, endZ, radius, heights, includeAircraft = false }) => {
      if (!airportCollision.ready) return false;
      const dx = endX - startX;
      const dz = endZ - startZ;
      const distance = Math.hypot(dx, dz);
      if (!(distance > 0.0005)) return false;
      airportCollision.direction.set(dx / distance, 0, dz / distance);
      const sideX = -airportCollision.direction.z;
      const sideZ = airportCollision.direction.x;
      const targets = includeAircraft && airportCollision.aircraftTarget
        ? [...airportCollision.staticTargets, airportCollision.aircraftTarget]
        : airportCollision.staticTargets;
      const rayLength = distance + radius + 0.2;
      const probes = [
        { side: -0.82, height: heights[0] },
        { side: 0, height: heights[0] },
        { side: 0.82, height: heights[0] },
        { side: 0, height: heights[1] },
        { side: 0, height: heights[2] },
      ];
      for (const probe of probes) {
        airportCollision.origin.set(
          startX + sideX * radius * probe.side,
          probe.height,
          startZ + sideZ * radius * probe.side,
        );
        airportCollision.raycaster.set(airportCollision.origin, airportCollision.direction);
        airportCollision.raycaster.near = 0.04;
        airportCollision.raycaster.far = rayLength;
        const hit = airportCollision.raycaster
          .intersectObjects(targets, true)
          .find(collisionHitEligible);
        if (hit) return true;
      }
      return false;
    };
    const aircraftCollisionSamples = (x, z, yaw) => {
      const local = [
        [0, 0],
        [0, 8.5],
        [0, 17.5],
        [0, 26.5],
        [-10.8, 12.5],
        [10.8, 12.5],
      ];
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      return local.map(([side, longitudinal]) => ({
        x: x + cos * side + sin * longitudinal,
        z: z - sin * side + cos * longitudinal,
      }));
    };
    renderer.domElement.dataset.airportCollisionAuthority = airportCollision.authority;
    renderer.domElement.dataset.airportCollisionReady = "false";
    renderer.domElement.dataset.airportCollisionTargetCount = "0";
    renderer.domElement.dataset.airportCollisionState = "clear";
    renderer.domElement.dataset.airportCollisionCount = "0";
    renderer.domElement.dataset.airportCollisionAircraftEnvelope = "nose-center-tail-wing-sweep-v2";
`;
    source = source.replace(readyAnchor, `${readyAnchor}${collisionRuntime}`);

    const collisionReady = `    void Promise.all([terminalLoad, groundLoad, photoGroundLoad])
      .then(() => {
        airportCollision.staticTargets = [
          environment.userData.authoredTerminal4,
          environment.userData.authoredTerminal4Jetways,
        ].filter((target) => target?.isObject3D);
        airportCollision.aircraftTarget = aircraft;
        airportCollision.ready = airportCollision.staticTargets.length === 2;
        const uploadedJetwayGroup = environment.userData.authoredTerminal4Jetways;
        renderer.domElement.dataset.airportCollisionReady = airportCollision.ready ? "true" : "false";
        renderer.domElement.dataset.airportCollisionTargetCount = String(airportCollision.staticTargets.length);
        renderer.domElement.dataset.terminal4A1RetractionAuthority = uploadedJetwayGroup?.userData?.uploadedJetwayA1RetractionAuthority || "missing";
        renderer.domElement.dataset.terminal4A1RetractionClearanceMeters = String(uploadedJetwayGroup?.userData?.uploadedJetwayA1RetractionClearanceMeters ?? "missing");
        renderer.domElement.dataset.environmentSource = environment.userData.environmentSource;`;
    source = source.replace(resolvedAnchor, collisionReady);

    const guardedMotion = `      const state = sim.dynamics;
      const previousTug = { x: rig.root.position.x, z: rig.root.position.z, yaw: rig.root.rotation.y };
      const tugBlocked = airportMovementBlocked({
        startX: previousTug.x,
        startZ: previousTug.z,
        endX: state.tugX,
        endZ: state.tugZ,
        radius: equipmentId === "standup-tug" ? 0.92 : 1.18,
        heights: equipmentId === "standup-tug" ? [0.48, 1.15, 1.9] : [0.42, 0.92, 1.55],
        includeAircraft: inspectionActive,
      });
      let aircraftBlocked = false;
      if (connectionHasAircraft(sim.connection)) {
        const previousSamples = aircraftCollisionSamples(aircraft.position.x, aircraft.position.z, aircraft.rotation.y);
        const nextSamples = aircraftCollisionSamples(state.aircraftX, state.aircraftZ, state.aircraftYaw);
        aircraftBlocked = previousSamples.some((sample, index) => airportMovementBlocked({
          startX: sample.x,
          startZ: sample.z,
          endX: nextSamples[index].x,
          endZ: nextSamples[index].z,
          radius: index >= 4 ? 1.35 : 1.05,
          heights: index >= 4 ? [1.1, 2.2, 3.5] : [0.72, 2.05, 3.8],
        }));
      }
      const collisionBlocked = tugBlocked || aircraftBlocked;
      if (collisionBlocked) {
        state.tugX = previousTug.x;
        state.tugZ = previousTug.z;
        state.tugYaw = previousTug.yaw;
        if (connectionHasAircraft(sim.connection)) {
          state.aircraftX = aircraft.position.x;
          state.aircraftZ = aircraft.position.z;
          state.aircraftYaw = aircraft.rotation.y;
        }
        state.speed = 0;
        if (!airportCollision.blocked) airportCollision.count += 1;
        if (now - airportCollision.lastMessageAt > 1200) {
          airportCollision.lastMessageAt = now;
          setMessage(inspectionActive
            ? "Collision prevented. Stop, steer clear, and continue the airport inspection."
            : "Collision prevented. Stop and correct the pushback path before continuing.");
        }
      }
      airportCollision.blocked = collisionBlocked;
      renderer.domElement.dataset.airportCollisionState = collisionBlocked ? "blocked" : "clear";
      renderer.domElement.dataset.airportCollisionCount = String(airportCollision.count);
      rig.root.position.set(state.tugX, 0, state.tugZ);`;
    source = source.replace(motionAnchor, guardedMotion);
    fs.writeFileSync(runtimePath, source, "utf8");
  }

  source = fs.readFileSync(runtimePath, "utf8");
  for (const token of [
    collisionAuthority,
    "airportCollision.staticTargets",
    "environment.userData.authoredTerminal4Jetways",
    "airportCollision.aircraftTarget = aircraft",
    "aircraftCollisionSamples",
    "dataset.airportCollision",
    "terminal4A1RetractionClearanceMeters",
  ]) {
    if (!source.includes(token)) throw new Error(`Airport collision runtime is missing ${token}`);
  }
}

function prepareJetwayRetraction() {
  let source = fs.readFileSync(jetwayPath, "utf8");
  if (!source.includes(retractionAuthority)) {
    const authorityAnchor = 'const PERFORMANCE_AUTHORITY = "57-static-jetways-and-connectors-instanced-plus-1-animated-a1-v5";';
    const motionBlock = `    anchor.rotation.y = base.yaw - retract * 0.105;
    if (nodes.tunnelB) nodes.tunnelB.position.z = base.tunnelB.z - retract * 1.1;
    if (nodes.tunnelC) nodes.tunnelC.position.z = base.tunnelC.z - retract * 2.25;
    if (nodes.cab) {
      nodes.cab.position.z = base.cab.z - retract * 3.85;
      nodes.cab.position.y = base.cab.y + retract * 0.16;
    }`;
    const metadataAnchor = "  group.userData.uploadedJetwayExpectedCount = placements.length;";
    for (const [name, anchor] of Object.entries({ authorityAnchor, motionBlock, metadataAnchor })) {
      if (!source.includes(anchor)) throw new Error(`A1 retraction normalization anchor missing: ${name}`);
    }
    source = source.replace(
      authorityAnchor,
      `${authorityAnchor}\nconst A1_RETRACTION_AUTHORITY = "${retractionAuthority}";\nconst A1_RETRACTION = Object.freeze({ rotation: 0.052, tunnelB: 0.42, tunnelC: 0.78, cab: 1.18, lift: 0.08, totalClearanceMeters: 2.38 });`,
    );
    source = source.replace(
      motionBlock,
      `    anchor.rotation.y = base.yaw - retract * A1_RETRACTION.rotation;
    if (nodes.tunnelB) nodes.tunnelB.position.z = base.tunnelB.z - retract * A1_RETRACTION.tunnelB;
    if (nodes.tunnelC) nodes.tunnelC.position.z = base.tunnelC.z - retract * A1_RETRACTION.tunnelC;
    if (nodes.cab) {
      nodes.cab.position.z = base.cab.z - retract * A1_RETRACTION.cab;
      nodes.cab.position.y = base.cab.y + retract * A1_RETRACTION.lift;
    }
    anchor.userData.retractionAuthority = A1_RETRACTION_AUTHORITY;
    anchor.userData.retractionClearanceMeters = A1_RETRACTION.totalClearanceMeters;`,
    );
    source = source.replace(
      metadataAnchor,
      `${metadataAnchor}\n  group.userData.uploadedJetwayA1RetractionAuthority = A1_RETRACTION_AUTHORITY;\n  group.userData.uploadedJetwayA1RetractionClearanceMeters = A1_RETRACTION.totalClearanceMeters;`,
    );
    fs.writeFileSync(jetwayPath, source, "utf8");
  }

  source = fs.readFileSync(jetwayPath, "utf8");
  for (const token of [
    retractionAuthority,
    "totalClearanceMeters: 2.38",
    "A1_RETRACTION.tunnelB",
    "A1_RETRACTION.tunnelC",
    "A1_RETRACTION.cab",
    "uploadedJetwayA1RetractionClearanceMeters",
  ]) {
    if (!source.includes(token)) throw new Error(`A1 retraction normalization is missing ${token}`);
  }
  for (const rejected of ["retract * 0.105", "retract * 2.25", "retract * 3.85"]) {
    if (source.includes(rejected)) throw new Error(`A1 jetway still contains rejected overtravel: ${rejected}`);
  }
}

prepareJetwayRetraction();
prepareCollisionRuntime();
console.log("Prepared physical airport collision protection and normalized A1 jetway door-clearance retraction without replacing the uploaded model.");
