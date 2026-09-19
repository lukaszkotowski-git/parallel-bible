import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyReadingSettings } from "./lib/reading-settings";

applyReadingSettings();

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
