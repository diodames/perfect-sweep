import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PerfectSweep from "./perfect-sweep.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PerfectSweep />
  </StrictMode>
);
