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
    setActiveEquipmentId(null);
  }, [stopGyro]);

  const launch = useCallback((mode) => {
    setLaunchMode(mode);
    setActiveEquipmentId(selectedEquipmentId);
  }, [selectedEquipmentId]);

  // Keep the equipment selector as the real default route. The query string is
  // an evidence-only launch request applied after the normal initial state has
  // mounted, so production/user navigation remains unchanged without a query.
  useEffect(() => {
    if (!initialInspectionPreset || activeEquipmentId) return;
    setLaunchMode("inspection");
    setActiveEquipmentId(DEFAULT_EQUIPMENT_ID);
  }, [activeEquipmentId, initialInspectionPreset]);

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
    const launchable = isEquipmentLaunchable(selectedEquipmentId);
    return (
      <main className="rr-equipment-setup" aria-labelledby="equipment-heading">
        <section className="rr-equipment-panel">
          <p className="rr-equipment-kicker">RampReady · PHX Terminal 4</p>
          <h1 id="equipment-heading">Choose pushback equipment</h1>
          <p className="rr-equipment-intro">Train the pushback procedure, or launch directly into an unrestricted tug inspection of the airport.</p>
          <div className="rr-equipment-grid" role="radiogroup" aria-label="Pushback equipment">
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
              <span>{selectedEquipment.available ? "Available in the current simulator runtime." : "Cannot launch until its actual runtime model is committed and verified."}</span>
            </div>
            <div className="rr-launch-actions">
              <button type="button" disabled={!launchable} onClick={() => launch("training")}>Start training</button>
              <button type="button" disabled={!launchable} onClick={() => launch("inspection")}>Drive tug / inspect airport</button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
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
  );
}
