import React from "react";
import {
  A1_TURNAROUND_ASSIGNMENT as assignment,
  getA1TurnaroundProgress,
  getA1TurnaroundResult,
  isA1ReadyForPushback,
} from "../simulation/a1TurnaroundMission.js";
import "./a1-turnaround.css";

function Task({ number, title, detail, done, disabled, onClick, buttonLabel }) {
  return <section className={`a1-task${done ? " a1-task-done" : ""}`}>
    <div className="a1-task-number" aria-hidden="true">{done ? "✓" : number}</div>
    <div className="a1-task-body">
      <h3>{title}</h3>
      <p>{detail}</p>
      <button type="button" disabled={done || disabled} onClick={onClick}>
        {done ? "Completed" : buttonLabel}
      </button>
    </div>
  </section>;
}

export default function A1TurnaroundBoard({ mission, onAction, onExit }) {
  const progress = getA1TurnaroundProgress(mission);
  const result = getA1TurnaroundResult(mission);
  const servicing = mission.phase === "servicing";
  const unloadingDone = mission.offloaded === assignment.inboundBags;
  const loadingDone = mission.loaded === assignment.outboundBags;
  const ready = isA1ReadyForPushback(mission);
  return <main className="a1-board">
    <div className="a1-layout">
      <header className="a1-header">
        <div>
          <p className="a1-eyebrow">RampReady · PHX Terminal 4 · Training mission</p>
          <h1>Gate A1 turnaround</h1>
          <p className="a1-subtitle">One complete departure sequence, from ramp setup to physical pushback.</p>
        </div>
        <button className="a1-exit" type="button" onClick={onExit}>← Equipment selection</button>
      </header>
      <div className="a1-summary" aria-label="Mission assignment">
        <div><span>Assignment</span><strong>{assignment.id}</strong></div>
        <div><span>Gate / aircraft</span><strong>{assignment.gate} · {assignment.aircraft}</strong></div>
        <div><span>Inbound</span><strong>{mission.offloaded} / {assignment.inboundBags} bags</strong></div>
        <div><span>Outbound</span><strong>{mission.loaded} / {assignment.outboundBags} bags</strong></div>
        <div><span>Mission checkpoints</span><strong>{progress.completed} / {progress.total}</strong></div>
      </div>
      <div className="a1-progress" role="progressbar" aria-label="Turnaround checkpoints" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}>
        <span style={{ width: `${(100 * progress.completed) / progress.total}%` }} />
      </div>
      {mission.phase === "briefing" && <section className="a1-briefing">
        <div className="a1-section-label">01 / Flight assignment</div>
        <h2>Receive the A1 aircraft</h2>
        <p>Training scenario: an arriving {assignment.aircraft} at {assignment.airport}. The bag counts are fictional exercise values, not live airline data.</p>
        <p>Complete the operational confirmations below before releasing the aircraft for the existing 3D tug and jetway pushback procedure. This first version records baggage handling on the operations board; it does not animate bag loading.</p>
        <button className="a1-main-action" type="button" onClick={() => onAction({ type: "accept" })}>Accept assignment →</button>
      </section>}
      {servicing && <>
        <div className="a1-section-label">02 / Ramp service and safety confirmations</div>
        <div className="a1-tasks">
          <Task number="1" title="Secure the aircraft" done={mission.gateSecure}
            detail="Confirm parking brake set and wheel chocks installed before servicing."
            buttonLabel="Confirm secured" onClick={() => onAction({ type: "secureGate" })} />
          <Task number="2" title="Establish ramp safety zone" done={mission.conesPlaced}
            disabled={!mission.gateSecure}
            detail="Confirm cones and safe equipment boundaries are in place."
            buttonLabel="Confirm safety zone" onClick={() => onAction({ type: "placeCones" })} />
          <Task number="3" title="Unload inbound baggage" done={unloadingDone}
            disabled={!mission.conesPlaced}
            detail={`${mission.offloaded} of ${assignment.inboundBags} bags recorded. Each tap records ${assignment.transferBatch} handled bags.`}
            buttonLabel={`Record next ${Math.min(assignment.transferBatch, assignment.inboundBags - mission.offloaded)} unloaded`}
            onClick={() => onAction({ type: "unload" })} />
          <Task number="4" title="Load outbound baggage" done={loadingDone}
            disabled={!unloadingDone}
            detail={`${mission.loaded} of ${assignment.outboundBags} bags recorded. Complete the inbound unload first.`}
            buttonLabel={`Record next ${Math.min(assignment.transferBatch, assignment.outboundBags - mission.loaded)} loaded`}
            onClick={() => onAction({ type: "load" })} />
          <Task number="5" title="Clear baggage equipment" done={mission.equipmentClear}
            disabled={!loadingDone}
            detail="Confirm carts, belt loader and service vehicles have moved clear of the aircraft."
            buttonLabel="Confirm GSE clear" onClick={() => onAction({ type: "clearEquipment" })} />
          <Task number="6" title="Remove safety cones" done={mission.conesRemoved}
            disabled={!mission.equipmentClear}
            detail="Confirm service zone cones are collected after the equipment is clear."
            buttonLabel="Confirm cones removed" onClick={() => onAction({ type: "removeCones" })} />
          <Task number="7" title="Remove chocks at departure clearance" done={mission.chocksRemoved}
            disabled={!mission.conesRemoved}
            detail="Confirm the aircraft parking brake remains set while wheel chocks are removed. Brake release is a separate step in the 3D pushback flow."
            buttonLabel="Confirm chocks removed" onClick={() => onAction({ type: "removeChocks" })} />
        </div>
        <section className="a1-release">
          <h2>Release for 3D pushback</h2>
          <p>{ready
            ? "All board tasks are confirmed. Continue into the existing live A1 simulator to retract the jetway, capture the nose gear and complete pushback."
            : "Release is blocked until baggage counts, equipment clearance and safety confirmations are complete."}</p>
          <button className="a1-main-action" type="button" disabled={!ready} onClick={() => onAction({ type: "startPushback" })}>
            Begin live A1 pushback →
          </button>
        </section>
      </>}
      {mission.phase === "complete" && result && <section className="a1-finished" aria-live="polite">
        <div className="a1-section-label">03 / Completed turnaround</div>
        <h2>Gate A1 departure complete</h2>
        <p>Both baggage operations records were completed and the real 3D tug scenario reached its final clear-of-aircraft stage.</p>
        <strong className="a1-final-score">{result.pushbackScore} <small>/ 100 pushback points</small></strong>
        <p>{result.bagsOffloaded} inbound and {result.bagsLoaded} outbound bags recorded. Manual confirmations are not scored as physical 3D actions.</p>
        <div className="a1-finished-buttons">
          <button type="button" className="a1-main-action" onClick={() => onAction({ type: "restart" })}>Run another turnaround</button>
          <button type="button" className="a1-exit" onClick={onExit}>Back to equipment</button>
        </div>
      </section>}
      <p className="a1-disclaimer">Mission board v1: manual ramp confirmations and bag tallies. Exact physics, jetway retraction, equipment handling and pushback scoring remain owned by the existing 3D runtime. Do not use this exercise for real-world dispatch.</p>
    </div>
  </main>;
}
