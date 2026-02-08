import React from "react";

export function SheetTabs(props: {
  activeTab: "core" | "skills" | "combat" | "initiative" | "inventory" | "feats";
  onTab: (tab: "core" | "skills" | "combat" | "initiative" | "inventory" | "feats") => void;
  isSaving: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
      <Tab label="Core" active={props.activeTab === "core"} onClick={() => props.onTab("core")} />
      <Tab label="Skills" active={props.activeTab === "skills"} onClick={() => props.onTab("skills")} />
      <Tab label="Combat" active={props.activeTab === "combat"} onClick={() => props.onTab("combat")} />
      <Tab label="Initiative" active={props.activeTab === "initiative"} onClick={() => props.onTab("initiative")} />
      <Tab label="Inventory" active={props.activeTab === "inventory"} onClick={() => props.onTab("inventory")} />
      <Tab label="Feats" active={props.activeTab === "feats"} onClick={() => props.onTab("feats")} />
      <div style={{ marginLeft: "auto", opacity: 0.8 }}>{props.isSaving ? "Saving…" : "Synced"}</div>
    </div>
  );
}

function Tab(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #777",
        cursor: "pointer",
        background: "transparent",
        fontWeight: props.active ? 700 : 400
      }}
    >
      {props.label}
    </button>
  );
}
