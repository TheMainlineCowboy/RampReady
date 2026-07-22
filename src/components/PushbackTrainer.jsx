import React, { useCallback, useEffect, useRef, useState } from "react";
import RampReadyStandupTrainer from "./RampReadyStandupTrainer.jsx";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function PushbackTrainer() {
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroAvailable, setGyroAvailable] = useState(true);
  const baselineRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0, active: false });

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

  useEffect(() => {
    if (!gyroEnabled) return undefined;
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
        canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: pointerRef.current.x, clientY: pointerRef.current.y, pointerId: 91, pointerType: "touch" }));
        pointerRef.current.active = true;
      }
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, cancelable: true, clientX: nextX, clientY: nextY, pointerId: 91, pointerType: "touch" }));
      pointerRef.current.x = nextX;
      pointerRef.current.y = nextY;
    };
    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 91, pointerType: "touch" }));
      pointerRef.current.active = false;
    };
  }, [gyroEnabled]);

  return (
    <>
      <RampReadyStandupTrainer />
      {gyroAvailable && (
        <button type="button" aria-pressed={gyroEnabled} onClick={gyroEnabled ? stopGyro : startGyro} style={{ position: "fixed", right: "max(12px, env(safe-area-inset-right))", bottom: "max(12px, env(safe-area-inset-bottom))", zIndex: 40, minWidth: 104, minHeight: 44, border: "1px solid rgba(255,255,255,0.45)", borderRadius: 10, background: gyroEnabled ? "rgba(20,110,58,0.92)" : "rgba(17,24,39,0.88)", color: "white", fontWeight: 700, padding: "10px 14px", backdropFilter: "blur(8px)" }}>
          Gyro {gyroEnabled ? "On" : "Off"}
        </button>
      )}
    </>
  );
}
