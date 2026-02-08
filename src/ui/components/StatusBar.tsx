import React from "react";
import type { CharacterSheetV1 } from "../../rules/schema";

export function StatusBar(props: {
  sheet: CharacterSheetV1;
  sheetForView: CharacterSheetV1;
  totalBulk: number;
  effectiveCarryingCapacity: number;
  encumbranceLabel: string;
  crucible: null | { incoming: number; dc: number; status: "pending" | "success" | "fail"; total?: number };
  applyStress: (nextStress: number) => void;
  toggleWound: (kind: "light" | "moderate" | "heavy", idx: number) => void;
  setIndomitable: (next: boolean) => void;
  rollCrucibleTest: (incoming: number) => void;
  burnCufToPass: () => void;
}) {
  return (
    <div style={styles.statusBar}>
      <div style={styles.statusLeft}>
        <div style={styles.statusGroup}>
          <div style={styles.statusLabel}>Stress</div>
          <input
            type="number"
            min={0}
            value={props.sheet.stress?.current ?? 0}
            onChange={(e) => props.applyStress(Number(e.target.value))}
            style={styles.statusNumber}
          />
        </div>

        <div style={styles.statusGroup}>
          <div style={styles.statusLabel}>Wounds</div>
          <div style={styles.woundsRow}>
            <span style={styles.woundsKind}>L</span>
            {Array.from({ length: 4 }).map((_, i) => (
              <input
                key={`wl_${i}`}
                type="checkbox"
                checked={(props.sheet.wounds?.light ?? 0) > i}
                onChange={() => props.toggleWound("light", i)}
              />
            ))}
            <span style={{ width: 8 }} />
            <span style={styles.woundsKind}>M</span>
            {Array.from({ length: 2 }).map((_, i) => (
              <input
                key={`wm_${i}`}
                type="checkbox"
                checked={(props.sheet.wounds?.moderate ?? 0) > i}
                onChange={() => props.toggleWound("moderate", i)}
              />
            ))}
            <span style={{ width: 8 }} />
            <span style={styles.woundsKind}>H</span>
            {Array.from({ length: 1 }).map((_, i) => (
              <input
                key={`wh_${i}`}
                type="checkbox"
                checked={(props.sheet.wounds?.heavy ?? 0) > i}
                onChange={() => props.toggleWound("heavy", i)}
              />
            ))}
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={!!props.sheet.indomitable}
            onChange={(e) => props.setIndomitable(e.target.checked)}
          />
          <span style={{ fontSize: 12, opacity: 0.9 }}>Indomitable</span>
        </label>

        {(props.sheet.stress?.current ?? 0) > (props.sheetForView.stress?.cuf ?? 0) && (
          <div style={styles.warning}>
            Stress &gt; CUF: make all rolls with +1 Penalty Die
          </div>
        )}

        <div style={{ fontSize: 12, opacity: 0.85 }}>
          Bulk: {props.totalBulk} / {props.effectiveCarryingCapacity}
        </div>
        {props.encumbranceLabel && <div style={styles.warning}>{props.encumbranceLabel}</div>}
      </div>

      <div style={styles.statusRight}>
        {props.crucible && props.crucible.status === "pending" && (
          <div style={styles.crucibleBox}>
            <div style={{ fontWeight: 700 }}>Crucible Test!</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Incoming stress: {props.crucible.incoming} • DC {props.crucible.dc} • Roll CUF (no bonus/penalty dice)
            </div>
            <button style={styles.buttonSecondary} onClick={() => props.rollCrucibleTest(props.crucible!.incoming)}>
              Roll Crucible
            </button>
          </div>
        )}

        {props.crucible && props.crucible.status === "success" && (
          <div style={styles.crucibleBox}>
            <div style={{ fontWeight: 700 }}>Crucible succeeded!</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Choose an Indomitable effect. (Indomitable checked automatically.)
            </div>
          </div>
        )}

        {props.crucible && props.crucible.status === "fail" && (
          <div style={styles.crucibleBox}>
            <div style={{ fontWeight: 700 }}>Crucible failed</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              You’ve entered PTSD range (6–8 stress).
            </div>
            <button style={styles.buttonSecondary} onClick={props.burnCufToPass}>
              Spend 1 CUF to pass
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  statusBar: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    marginBottom: 10,
  },
  statusLeft: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  statusRight: { display: "flex", alignItems: "center", gap: 12 },
  statusGroup: { display: "flex", flexDirection: "column", gap: 4 },
  statusLabel: { fontSize: 11, opacity: 0.75, letterSpacing: 0.2 },
  statusNumber: {
    width: 64,
    fontSize: 16,
  },
  woundsRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  woundsKind: { fontSize: 11, opacity: 0.75, width: 14, textAlign: "center" },
  warning: { marginTop: 8, fontSize: 12, opacity: 0.9 },
  crucibleBox: {
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 12,
    padding: 10,
    maxWidth: 240,
  },
  buttonSecondary: { padding: "6px 10px", borderRadius: 8, border: "1px solid #999", cursor: "pointer", opacity: 0.9, background: "transparent" },
};
