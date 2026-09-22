import PushbackTrainer from "./components/PushbackTrainer.jsx";
import KphxFullAirportVerifier from "./components/KphxFullAirportVerifier.jsx";

export default function App() {
  const fullAirportVerifier = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("kphxFullAirport") === "1";
  return fullAirportVerifier ? <KphxFullAirportVerifier /> : <PushbackTrainer />;
}
