import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import { getApiBaseUrl } from "./lib/api-base-url";
import { initializeNativeShell } from "./lib/capacitor";
import "./index.css";

const apiBaseUrl = getApiBaseUrl();
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

createRoot(document.getElementById("root")!).render(<App />);
void initializeNativeShell();
