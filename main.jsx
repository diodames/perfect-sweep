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

// Static SEO copy lives in index.html for crawlers that skip JS. Hide it once
// the game mounts so it does not sit under the app UI (progressive enhancement).
const seoContent = document.getElementById("seo-content");
if (seoContent) seoContent.hidden = true;
