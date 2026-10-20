// Gate A1 turnaround: mission-board tasks are acknowledged/recorded by the user.
// Aircraft movement, jetway motion and tug handling remain authoritative in the 3D runtime.
export const A1_TURNAROUND_ASSIGNMENT = Object.freeze({
  id: "RR-A1-001",
  gate: "A1",
  airport: "KPHX Terminal 4",
  aircraft: "CRJ900",
  inboundBags: 12,
  outboundBags: 16,
  transferBatch: 4,
});

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

export function createA1TurnaroundMission() {
  return {
    phase: "briefing",
    gateSecure: false,
    conesPlaced: false,
    offloaded: 0,
    loaded: 0,
    equipmentClear: false,
    conesRemoved: false,
    chocksRemoved: false,
    pushbackStage: 0,
    pushbackScore: null,
  };
}

export function isA1ReadyForPushback(mission) {
  return mission.phase === "servicing"
    && mission.gateSecure
    && mission.conesPlaced
    && mission.offloaded === A1_TURNAROUND_ASSIGNMENT.inboundBags
    && mission.loaded === A1_TURNAROUND_ASSIGNMENT.outboundBags
    && mission.equipmentClear
    && mission.conesRemoved
    && mission.chocksRemoved;
}

export function getA1TurnaroundProgress(mission) {
  const steps = [
    mission.phase !== "briefing",
    mission.gateSecure,
    mission.conesPlaced,
    mission.offloaded === A1_TURNAROUND_ASSIGNMENT.inboundBags,
    mission.loaded === A1_TURNAROUND_ASSIGNMENT.outboundBags,
    mission.equipmentClear,
    mission.conesRemoved,
    mission.chocksRemoved,
    mission.phase === "complete",
  ];
  return { completed: steps.filter(Boolean).length, total: steps.length };
}

export function getA1TurnaroundResult(mission) {
  if (mission.phase !== "complete" || mission.pushbackScore === null) return null;
  return {
    gate: A1_TURNAROUND_ASSIGNMENT.gate,
    assignment: A1_TURNAROUND_ASSIGNMENT.id,
    bagsOffloaded: mission.offloaded,
    bagsLoaded: mission.loaded,
    pushbackScore: mission.pushbackScore,
    // Manual confirmations are not independently verified by 3D interactions.
    // The pushback score is reported separately, not blended into a fictional safety score.
    status: "Completed: board confirmations + simulated pushback",
  };
}

export function advanceA1Turnaround(mission, action) {
  if (!mission || !action || typeof action.type !== "string") return mission;
  if (action.type === "restart") return createA1TurnaroundMission();
  if (mission.phase === "complete") return mission;
  const target = A1_TURNAROUND_ASSIGNMENT;
  switch (action.type) {
    case "accept":
      return mission.phase === "briefing" ? { ...mission, phase: "servicing" } : mission;
    case "secureGate":
      return mission.phase === "servicing" && !mission.gateSecure
        ? { ...mission, gateSecure: true } : mission;
    case "placeCones":
      return mission.phase === "servicing" && mission.gateSecure && !mission.conesPlaced
        ? { ...mission, conesPlaced: true } : mission;
    case "unload":
      return mission.phase === "servicing" && mission.gateSecure && mission.conesPlaced
        && mission.offloaded < target.inboundBags
        ? { ...mission, offloaded: Math.min(target.inboundBags, mission.offloaded + target.transferBatch) }
        : mission;
    case "load":
      return mission.phase === "servicing" && mission.offloaded === target.inboundBags
        && mission.loaded < target.outboundBags && mission.conesPlaced
        ? { ...mission, loaded: Math.min(target.outboundBags, mission.loaded + target.transferBatch) }
        : mission;
    case "clearEquipment":
      return mission.phase === "servicing" && mission.loaded === target.outboundBags
        && !mission.equipmentClear
        ? { ...mission, equipmentClear: true } : mission;
    case "removeCones":
      return mission.phase === "servicing" && mission.equipmentClear && !mission.conesRemoved
        ? { ...mission, conesRemoved: true } : mission;
    case "removeChocks":
      return mission.phase === "servicing" && mission.conesRemoved && !mission.chocksRemoved
        ? { ...mission, chocksRemoved: true } : mission;
    case "startPushback":
      return isA1ReadyForPushback(mission)
        ? { ...mission, phase: "pushback", pushbackStage: 0 } : mission;
    case "pushbackProgress": {
      if (mission.phase !== "pushback") return mission;
      const stage = Number(action.stage);
      if (!Number.isInteger(stage) || stage < 0 || stage > 8) return mission;
      // A runtime reset may legitimately return the 3D trainer to stage zero.
      if (stage === 8) {
        return {
          ...mission,
          phase: "complete",
          pushbackStage: 8,
          pushbackScore: clampScore(action.score),
        };
      }
      return stage === mission.pushbackStage ? mission : { ...mission, pushbackStage: stage };
    }
    default:
      return mission;
  }
}
