import PushbackTrainer from "./components/PushbackTrainer.jsx";
import KphxFullAirportVerifier from "./components/KphxFullAirportVerifier.jsx";
import KphxT4FrameVerifier from "./components/KphxT4FrameVerifier.jsx";
import KphxT4BuildingShellVerifier from "./components/KphxT4BuildingShellVerifier.jsx";
import KphxT4GroundVerifier from "./components/KphxT4GroundVerifier.jsx";
import KphxT4JetwayBatchVerifier from "./components/KphxT4JetwayBatchVerifier.jsx";
import KphxA1StockJetwayVerifier from "./components/KphxA1StockJetwayVerifier.jsx";

export default function App() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const t4FrameVerifier = params?.get("kphxT4Frame") === "1";
  const t4GroundVerifier = params?.get("kphxT4Ground") === "1";
  const a1JetwayVerifier = params?.get("kphxA1Jetway") === "1";
  const t4JetwayBatchVerifier = params?.get("kphxT4Jetways") === "1";
  const fullAirportVerifier = params?.get("kphxFullAirport") === "1";
  const t4BuildingShellVerifier = params?.get("kphxT4Buildings") === "1";
  if (t4BuildingShellVerifier) return <KphxT4BuildingShellVerifier />;
  if (t4JetwayBatchVerifier) return <KphxT4JetwayBatchVerifier />;
  if (a1JetwayVerifier) return <KphxA1StockJetwayVerifier />;
  if (t4GroundVerifier) return <KphxT4GroundVerifier />;
  if (t4FrameVerifier) return <KphxT4FrameVerifier />;
  return fullAirportVerifier ? <KphxFullAirportVerifier /> : <PushbackTrainer />;
}
