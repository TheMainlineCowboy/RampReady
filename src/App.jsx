import PushbackTrainer from "./components/PushbackTrainer.jsx";
import KphxFullAirportVerifier from "./components/KphxFullAirportVerifier.jsx";
import KphxT4FrameVerifier from "./components/KphxT4FrameVerifier.jsx";

export default function App() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const t4FrameVerifier = params?.get("kphxT4Frame") === "1";
  const fullAirportVerifier = params?.get("kphxFullAirport") === "1";
  if (t4FrameVerifier) return <KphxT4FrameVerifier />;
  return fullAirportVerifier ? <KphxFullAirportVerifier /> : <PushbackTrainer />;
}
