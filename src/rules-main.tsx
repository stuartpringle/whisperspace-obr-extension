import React from "react";
import ReactDOM from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import { ObrMuiThemeProvider } from "./ui/ObrMuiThemeProvider";
import { RulesApp } from "./ui/RulesApp";

async function boot() {
  await OBR.onReady(async () => {});

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ObrMuiThemeProvider>
        <RulesApp />
      </ObrMuiThemeProvider>
    </React.StrictMode>
  );
}

boot();
