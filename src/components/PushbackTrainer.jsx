import React, { useCallback, useEffect, useRef, useState } from "react";
import RampReadyStandupTrainer from "./RampReadyStandupTrainerTerminal4.jsx";
import {
  DEFAULT_EQUIPMENT_ID,
  EQUIPMENT_PROFILES,
  getEquipmentProfile,
  isEquipmentLaunchable,
} from "../config/equipmentProfiles.js";
import "./equipment-selection.css";

const RampReadyLektroPrototypeTrainer = RampReadyStandupTrainer;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const VISUAL_INSPECTION_PRESETS = new Set(["a1", "a1Connection", "a14", "b14", "b15"]);

function requestedInspectionPreset() {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("inspectionPreset");
  return requested && VISUAL_INSPECTION_PRESETS.has(requested) ? requested : null;
}

export default function PushbackTrainer() {
  const initialInspectionPreset = requestedInspectionPreset();
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroAvailable, setGyroAvailable] = useState(true);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(DEFAULT_EQUIPMENT_ID);
  const [activeEquipmentId, setActiveEquipmentId] = useState(null);
  const [launchMode, setLaunchMode] = useState("training");
  const [runtimeLoading, setRuntimeLoading] = useState({
    active: false,
    completed: 0,
    total: 4,
    label: "Preparing simulator…",
    failed: false,
    errorDetail: "",
  });
  const baselineRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const selectedEquipment = getEquipmentProfile(selectedEquipmentId);

  const stopGyro = useCallback(() => {
    baselineRef.current = null;
    pointerRef.current.active = false;
    setGyroEnabled(false);
  }, []);

  const startGyro = useCallback(async () => {
    if (!("DeviceOrientationEvent" in window)) {
      setGyroAvailable(false);
      return;
    }
    const OrientationEvent = window.DeviceOrientationEvent;
    if (typeof OrientationEvent.requestPermission === "function") {
      const permission = await OrientationEvent.requestPermission();
      if (permission !== "granted") return;
    }
    baselineRef.current = null;
    pointerRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false };
    setGyroEnabled(true);
  }, []);

  const toggleGyro = useCallback(() => {
    if (gyroEnabled) stopGyro();
    else void startGyro();
  }, [gyroEnabled, startGyro, stopGyro]);

  const changeEquipment = useCallback(() => {
    stopGyro();
    setLaunchMode("training");
    setRuntimeLoading({ active: false, completed: 0, total: 4, label: "Preparing simulator…", failed: false, errorDetail: "" });
    setActiveEquipmentId(null);
  }, [stopGyro]);

  const beginRuntimeLoading = useCallback(() => {
    setRuntimeLoading({
      active: true,
      completed: 0,
      total: 4,
      label: "Loading selected equipment…",
      failed: false,
      errorDetail: "",
    });
  }, []);

  const launch = useCallback((mode) => {
    beginRuntimeLoading();
    setLaunchMode(mode);
    setActiveEquipmentId(selectedEquipmentId);
  }, [beginRuntimeLoading, selectedEquipmentId]);

  // Keep the equipment selector as the real default route. The query string is
  // an evidence-only launch request applied after the normal initial state has
  // mounted, so production/user navigation remains unchanged without a query.
  useEffect(() => {
    if (!initialInspectionPreset || activeEquipmentId) return;
    beginRuntimeLoading();
    setLaunchMode("inspection");
    setActiveEquipmentId(DEFAULT_EQUIPMENT_ID);
  }, [activeEquipmentId, beginRuntimeLoading, initialInspectionPreset]);

  useEffect(() => {
    if (!activeEquipmentId) return undefined;
    let cancelled = false;
    let timer = 0;

    const expectedTugSource = activeEquipmentId === "lektro-88"
      ? "lektro-ap88-tvo914-r187a"
      : activeEquipmentId === "standup-tug"
        ? "authored-standup"
        : activeEquipmentId === "manager-kubota"
          ? "manager-kubota-exact"
          : null;

    const poll = () => {
      if (cancelled) return;
      const canvas = document.querySelector("canvas.trainerCanvas");
      const data = canvas?.dataset || {};
      const equipmentReady = expectedTugSource
        ? data.tugSource === expectedTugSource
        : Boolean(data.tugSource && data.tugSource !== "loading" && data.tugSource !== "load-error");
      const terminalReady = data.kphxExactLiveT4 === "ready";
      const surfacesReady = data.kphxSurfaceReady === "true";
      const markingsReady = data.kphxT4ZdpMarkingsReady === "true" && data.kphxMisterXLinesReady === "true";
      const failed = [
        data.tugSource,
        data.kphxExactLiveT4,
        data.kphxSurfaceReady,
        data.kphxT4ZdpMarkingsReady,
        data.kphxMisterXLinesReady,
        data.environmentSource,
      ].includes("load-error");

      const errorDetail = failed
        ? (
          data.runtimeLoadError
          || data.kphxExactLiveT4Error
          || data.kphxSurfaceLoadError
          || data.kphxT4ZdpMarkingsLoadError
          || data.kphxMisterXLinesLoadError
          || data.tugLoadError
          || "A required runtime asset failed to load."
        )
        : "";
      const completed = [equipmentReady, terminalReady, surfacesReady, markingsReady].filter(Boolean).length;
      let label = "Loading selected equipment…";
      if (equipmentReady && !terminalReady) label = "Loading exact PHX Terminal 4 and jetways…";
      else if (equipmentReady && terminalReady && !surfacesReady) label = "Loading exact KPHX ramp surfaces…";
      else if (equipmentReady && terminalReady && surfacesReady && !markingsReady) label = "Loading exact Terminal 4 ramp markings…";
      else if (completed === 4) label = "RampReady";

      setRuntimeLoading((previous) => {
        const active = completed < 4 && !failed;
        if (
          previous.active === active
          && previous.completed === completed
          && previous.label === label
          && previous.failed === failed
          && previous.errorDetail === errorDetail
        ) return previous;
        return { active, completed, total: 4, label, failed, errorDetail };
      });

      if (completed < 4 && !failed) timer = window.setTimeout(poll, 100);
    };

    poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeEquipmentId]);

  useEffect(() => {
    if (!gyroEnabled || !activeEquipmentId) return undefined;
    const handleOrientation = (event) => {
      if (event.alpha == null || event.beta == null || event.gamma == null) return;
      if (!baselineRef.current) {
        baselineRef.current = { beta: event.beta, gamma: event.gamma };
        return;
      }
      const canvas = document.querySelector("canvas.trainerCanvas");
      if (!canvas) return;
      const betaDelta = clamp(event.beta - baselineRef.current.beta, -45, 45);
      const gammaDelta = clamp(event.gamma - baselineRef.current.gamma, -45, 45);
      const nextX = window.innerWidth / 2 + gammaDelta * 6;
      const nextY = window.innerHeight / 2 + betaDelta * 6;
      if (!pointerRef.current.active) {
        canvas.dispatchEvent(new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          clientX: pointerRef.current.x,
          clientY: pointerRef.current.y,
          pointerId: 91,
          pointerType: "touch",
        }));
        pointerRef.current.active = true;
      }
      window.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        clientX: nextX,
        clientY: nextY,
        pointerId: 91,
        pointerType: "touch",
      }));
      pointerRef.current.x = nextX;
      pointerRef.current.y = nextY;
    };
    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 91, pointerType: "touch" }));
      pointerRef.current.active = false;
    };
  }, [gyroEnabled, activeEquipmentId]);

  if (!activeEquipmentId) {
    const trainingLaunchable = isEquipmentLaunchable(selectedEquipmentId, "training");
    const inspectionLaunchable = isEquipmentLaunchable(selectedEquipmentId, "inspection");
    return (
      <main className="rr-equipment-setup" aria-labelledby="equipment-heading">
        <section className="rr-equipment-panel">
          <p className="rr-equipment-kicker">RampReady · PHX Terminal 4</p>
          <h1 id="equipment-heading">Choose RampReady equipment</h1>
          <p className="rr-equipment-intro">Train the pushback procedure, or launch directly into an unrestricted tug inspection of the airport.</p>
          <div className="rr-equipment-grid" role="radiogroup" aria-label="RampReady equipment">
            {EQUIPMENT_PROFILES.map((profile) => {
              const selected = profile.id === selectedEquipmentId;
              return (
                <button
                  type="button"
                  key={profile.id}
                  role="radio"
                  aria-checked={selected}
                  className={`rr-equipment-card${selected ? " is-selected" : ""}${profile.available ? "" : " is-pending"}`}
                  onClick={() => setSelectedEquipmentId(profile.id)}
                >
                  <span className="rr-equipment-status">{profile.statusLabel}</span>
                  <strong>{profile.label}</strong>
                  <small>{profile.manufacturer}</small>
                  <p>{profile.description}</p>
                  <ul>{profile.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul>
                </button>
              );
            })}
          </div>
          <div className="rr-equipment-actions">
            <div>
              <b>Selected:</b> {selectedEquipment.label}<br />
              <span>{
                selectedEquipment.id === "manager-kubota"
                  ? "Exact manager vehicle available for free-drive airport inspection."
                  : selectedEquipment.available
                    ? "Available in the current simulator runtime."
                    : "Cannot launch until its actual runtime model is committed and verified."
              }</span>
            </div>
            <div className="rr-launch-actions">
              <button type="button" disabled={!trainingLaunchable} onClick={() => launch("training")}>Start training</button>
              <button type="button" disabled={!inspectionLaunchable} onClick={() => launch("inspection")}>Drive vehicle / inspect airport</button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const loadingPercent = Math.round((runtimeLoading.completed / runtimeLoading.total) * 100);

  return (
    <div className="rr-runtime-host">
      <RampReadyLektroPrototypeTrainer
        key={`${activeEquipmentId}-${launchMode}-${initialInspectionPreset || "manual"}`}
        equipmentId={activeEquipmentId}
        initialInspectionMode={launchMode === "inspection"}
        initialInspectionPreset={initialInspectionPreset || "a1"}
        onChangeEquipment={changeEquipment}
        gyroAvailable={gyroAvailable}
        gyroEnabled={gyroEnabled}
        onToggleGyro={toggleGyro}
      />
      {(runtimeLoading.active || runtimeLoading.failed) && (
        <div className="rr-runtime-loading" role="status" aria-live="polite">
          <div className="rr-runtime-loading-card">
            <p className="rr-runtime-loading-kicker">RampReady · PHX</p>
            <h1>{runtimeLoading.failed ? "Unable to finish loading" : "Preparing simulator"}</h1>
            <p>{runtimeLoading.failed ? (runtimeLoading.errorDetail || "A required runtime asset failed to load.") : runtimeLoading.label}</p>
            <div className="rr-runtime-loading-track" aria-label="Simulator loading progress">
              <span style={{ width: `${loadingPercent}%` }} />
            </div>
            <b>{loadingPercent}%</b>
          </div>
        </div>
      )}
    </div>
  );
}
