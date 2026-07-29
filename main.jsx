import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import PerfectSweep from "./perfect-sweep.jsx";
import AdminMetrics from "./AdminMetrics.jsx";

const isAdminMetrics = typeof window !== "undefined"
  && /^\/admin\/metrics\/?$/.test(window.location.pathname);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isAdminMetrics ? <AdminMetrics /> : (
      <>
        <PerfectSweep />
        <Analytics />
      </>
    )}
  </StrictMode>
);
