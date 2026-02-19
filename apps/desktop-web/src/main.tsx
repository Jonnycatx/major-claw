import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { AppErrorBoundary } from "./components/AppErrorBoundary.js";
import { AppToastViewport } from "./components/AppToastViewport.js";
import "./globals.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
      <AppToastViewport />
    </AppErrorBoundary>
  </React.StrictMode>
);
