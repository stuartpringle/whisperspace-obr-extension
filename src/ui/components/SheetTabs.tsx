import React from "react";
import { useTheme } from "@mui/material";

export function SheetTabs(props: {
  activeTab: "core" | "skills" | "combat" | "initiative" | "inventory" | "feats";
  onTab: (tab: "core" | "skills" | "combat" | "initiative" | "inventory" | "feats") => void;
  isSaving: boolean;
}) {
  const theme = useTheme();
  const textColor = theme.palette.text.primary;
  const borderColor = theme.palette.mode === "dark" ? "rgba(255,255,255,0.25)" : "#777";

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
      <Tab label="Core" active={props.activeTab === "core"} onClick={() => props.onTab("core")} color={textColor} borderColor={borderColor} />
      <Tab label="Skills" active={props.activeTab === "skills"} onClick={() => props.onTab("skills")} color={textColor} borderColor={borderColor} />
      <Tab label="Combat" active={props.activeTab === "combat"} onClick={() => props.onTab("combat")} color={textColor} borderColor={borderColor} />
      <Tab label="Initiative" active={props.activeTab === "initiative"} onClick={() => props.onTab("initiative")} color={textColor} borderColor={borderColor} />
      <Tab label="Inventory" active={props.activeTab === "inventory"} onClick={() => props.onTab("inventory")} color={textColor} borderColor={borderColor} />
      <Tab label="Feats" active={props.activeTab === "feats"} onClick={() => props.onTab("feats")} color={textColor} borderColor={borderColor} />
      <div style={{ marginLeft: "auto", opacity: 0.8 }}>{props.isSaving ? "Saving…" : "Synced"}</div>
    </div>
  );
}

function Tab(props: { label: string; active: boolean; onClick: () => void; color: string; borderColor: string }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <button
      onClick={props.onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${props.borderColor}`,
        cursor: "pointer",
        background: "transparent",
        fontWeight: props.active ? 700 : 400,
        color: props.color,
        outline: "none",
        boxShadow: "none",
        appearance: "none",
      }}
    >
      {props.label}
    </button>
  );
}
