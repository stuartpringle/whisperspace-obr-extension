import React from "react";
import ReactDOM from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import { SheetApp } from "./ui/SheetApp";
import { ObrMuiThemeProvider } from "./ui/ObrMuiThemeProvider";

async function boot() {
  await OBR.onReady(async () => {});

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ObrMuiThemeProvider>
        <SheetApp />
      </ObrMuiThemeProvider>
    </React.StrictMode>
  );
}

boot();
