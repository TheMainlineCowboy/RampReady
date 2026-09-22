import PushbackTrainer from "./components/PushbackTrainer.jsx";
import KphxFullAirportVerifier from "./components/KphxFullAirportVerifier.jsx";
import KphxT4FrameVerifier from "./components/KphxT4FrameVerifier.jsx";
import KphxT4GroundVerifier from "./components/KphxT4GroundVerifier.jsx";

export default function App() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const t4FrameVerifier = params?.get("kphxT4Frame") === "1";
  const t4GroundVerifier = params?.get("kphxT4Ground") === "1";
  const fullAirportVerifier = params?.get("kphxFullAirport") === "1";
  if (t4GroundVerifier) return <KphxT4GroundVerifier />;
  if (t4FrameVerifier) return <KphxT4FrameVerifier />;
  return fullAirportVerifier ? <KphxFullAirportVerifier /> : <PushbackTrainer />;
}
