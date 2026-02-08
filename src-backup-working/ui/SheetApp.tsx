import React, { useEffect, useMemo, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { CharacterSheetV1 } from "../rules/schema";
import { ensureSheetOnToken,
  getMyCharacterTokenId,
  getOpenTokenOverride,
  saveSheetToToken,
  setMyCharacterTokenId,
  setOpenTokenOverride,
  TOKEN_KEY_OWNER_PLAYER,
  tagTokenOwnedByMe,
  findMyOwnedTokenId
 } from "../obr/metadata";
import { getFirstSelectedId, itemExists } from "../obr/selection";
import { CorePanel } from "./panels/CorePanel";
import { SkillsPanel } from "./panels/SkillsPanel";
import { FeatsPanel } from "./panels/FeatsPanel";
import { CombatPanel } from "./panels/CombatPanel";

import { deriveAttributesFromSkills } from "../rules/deriveAttributes";

type ViewState =
  | { kind: "loading" }
  | { kind: "need-token" }
  | {
      kind: "ready";
      tokenId: string;
      sheet: CharacterSheetV1;
      mode: "my" | "view";
      ownerLabel?: string;
      thumbUrl?: string | null;
    }
  | { kind: "error"; message: string };

export function SheetApp() {
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [activeTab, setActiveTab] = useState<"core" | "skills" | "combat" | "feats">("core");
  const [isSaving, setIsSaving] = useState(false);

  async function getTokenHeaderMeta(tokenId: string): Promise<{ ownerLabel: string; thumbUrl: string | null }> {
    try {
      const items = await OBR.scene.items.getItems([tokenId]);
      const it: any = items?.[0];
      if (!it) return { ownerLabel: "unowned", thumbUrl: null };

      // Thumbnail (best-effort; OBR item shapes vary)
      const thumbUrl: string | null =
        it?.image?.url ?? it?.image?.href ?? it?.imageUrl ?? it?.image ?? it?.thumbnail?.url ?? null;

      // Owner label
      const ownerPlayerId = it?.metadata?.[TOKEN_KEY_OWNER_PLAYER];
      if (typeof ownerPlayerId !== "string" || ownerPlayerId.length === 0) {
        return { ownerLabel: "unowned", thumbUrl };
      }

      const myId = await OBR.player.getId();
      if (ownerPlayerId === myId) return { ownerLabel: "owned by you", thumbUrl };

      // Try to resolve to a friendly name via party players
      try {
        const players: any[] = (await (OBR.party as any).getPlayers?.()) ?? [];
        const p = players.find((x) => x?.id === ownerPlayerId);
        const name = typeof p?.name === "string" && p.name.length > 0 ? p.name : ownerPlayerId;
        return { ownerLabel: `owned by ${name}`, thumbUrl };
      } catch {
        return { ownerLabel: `owned by ${ownerPlayerId}`, thumbUrl };
      }
    } catch {
      return { ownerLabel: "unowned", thumbUrl: null };
    }
  }

  // NOTE: this is best-effort; if a token has no ownership metadata or image, we fall back gracefully.

  async function load() {
    const openTokenId = await getOpenTokenOverride();
    if (openTokenId) {
      const exists = await itemExists(openTokenId);
      if (exists) {
        const sheet = await ensureSheetOnToken(openTokenId);
        if (!sheet) throw new Error("Could not load sheet from token.");
        // Ensure attributes are derived on load as well (in case older tokens stored stale values)
        const derived = deriveAttributesFromSkills(sheet.skills ?? {});
        const fixed: CharacterSheetV1 = { ...sheet, attributes: derived };
        const header = await getTokenHeaderMeta(openTokenId);
        setState({ kind: "ready", tokenId: openTokenId, sheet: fixed, mode: "view", ...header });
        return;
      } else {
        await setOpenTokenOverride(null);
      }
    }

    const myTokenId = await getMyCharacterTokenId();
    // If we have no saved token (or it went stale), try to recover via token ownership tag.
    let resolvedMyTokenId = myTokenId;
    if (!resolvedMyTokenId) {
      resolvedMyTokenId = await findMyOwnedTokenId();
      if (resolvedMyTokenId) await setMyCharacterTokenId(resolvedMyTokenId);
    }

    if (!resolvedMyTokenId) {
      setState({ kind: "need-token" });
      return;
    }

    let exists = await itemExists(resolvedMyTokenId);
    if (!exists) {
      // Saved id may point to an old token (deleted/replaced). Try to recover again.
      const recovered = await findMyOwnedTokenId();
      if (recovered) {
        resolvedMyTokenId = recovered;
        await setMyCharacterTokenId(resolvedMyTokenId);
        exists = await itemExists(resolvedMyTokenId);
      }
    }

    if (!exists) {
      await setMyCharacterTokenId(null);
      setState({ kind: "need-token" });
      return;
    }

    const sheet = await ensureSheetOnToken(resolvedMyTokenId);
    if (!sheet) throw new Error("Could not load sheet from token.");
    // Best-effort: tag token ownership so we can recover stickily and show owner labels.
    try { await tagTokenOwnedByMe(resolvedMyTokenId); } catch {}
    const derived = deriveAttributesFromSkills(sheet.skills ?? {});
    const fixed: CharacterSheetV1 = { ...sheet, attributes: derived };
    const header = await getTokenHeaderMeta(resolvedMyTokenId);
    setState({ kind: "ready", tokenId: resolvedMyTokenId, sheet: fixed, mode: "my", ...header });
  }

  useEffect(() => {
    let cancelled = false;
    OBR.onReady(async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setState({ kind: "error", message: (e as Error).message ?? "Unknown error" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const title = useMemo(
    () => (state.kind === "ready" ? state.sheet.name || "Whisperspace Sheet" : "Whisperspace Sheet"),
    [state]
  );

  async function setSelectedAsMine() {
    const selectedId = await getFirstSelectedId();
    if (!selectedId) {
      setState({ kind: "error", message: "No token selected. Select a token on the map first." });
      return;
    }
    const sheet = await ensureSheetOnToken(selectedId);
    if (!sheet) {
      setState({ kind: "error", message: "Could not attach a sheet to the selected token." });
      return;
    }
    const derived = deriveAttributesFromSkills(sheet.skills ?? {});
    const fixed: CharacterSheetV1 = { ...sheet, attributes: derived };

    await setMyCharacterTokenId(selectedId);
    // Tag ownership so the header can show "owned by…" and so we can recover stickily later.
    try { await tagTokenOwnedByMe(selectedId); } catch {}
    await setOpenTokenOverride(null);
    const header = await getTokenHeaderMeta(selectedId);
    setState({ kind: "ready", tokenId: selectedId, sheet: fixed, mode: "my", ...header });
  }

  async function unsetMyCharacter() {
    await setMyCharacterTokenId(null);
    setState({ kind: "need-token" });
  }

  async function backToMySheet() {
    await setOpenTokenOverride(null);
    setState({ kind: "loading" });
    try {
      await load();
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message ?? "Unknown error" });
    }
  }

  async function save(next: CharacterSheetV1) {
    if (state.kind !== "ready") return;
    setIsSaving(true);
    try {
      await saveSheetToToken(state.tokenId, next);
      setState({
        kind: "ready",
        tokenId: state.tokenId,
        sheet: next,
        mode: state.mode,
        ownerLabel: state.ownerLabel,
        thumbUrl: state.thumbUrl
      });
    } finally {
      setIsSaving(false);
    }
  }

  function updateSheet(mutator: (s: CharacterSheetV1) => CharacterSheetV1) {
    if (state.kind !== "ready") return;

    const draft = mutator(state.sheet);

    // Derive attributes from skills (¼ total ranks, rounded up). Not user-editable.
    const derived = deriveAttributesFromSkills(draft.skills ?? {});
    const next: CharacterSheetV1 = { ...draft, attributes: derived };

    void save(next);
  }

  if (state.kind === "loading") return <div style={{ padding: 12 }}>Loading…</div>;

  if (state.kind === "need-token") {
    return (
      <div style={{ padding: 12 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>My Sheet</h2>
        <p style={{ margin: "0 0 10px 0", lineHeight: 1.35 }}>
          Select your character token on the map, then click:
        </p>
        <button
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #666", cursor: "pointer" }}
          onClick={setSelectedAsMine}
        >
          Set Selected Token as My Character
        </button>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div style={{ padding: 12 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Error</h2>
        <p style={{ margin: "0 0 10px 0", lineHeight: 1.35 }}>{state.message}</p>
        <button
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #666", cursor: "pointer" }}
          onClick={() => setState({ kind: "need-token" })}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {state.thumbUrl ? (
            <img
              src={state.thumbUrl}
              alt="Token thumbnail"
              style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", border: "1px solid rgba(0,0,0,0.2)" }}
            />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", opacity: 0.4 }} />
          )}

          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {title}{" "}
              <span style={{ fontSize: 12, opacity: 0.75 }}>
                ({state.ownerLabel ?? (state.mode === "view" ? "Viewing token" : "My Character")})
              </span>
            </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Token: <code style={{ fontSize: 11 }}>{state.tokenId}</code>
          </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {state.mode === "view" ? (
            <button
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #999", cursor: "pointer", opacity: 0.9 }}
              onClick={backToMySheet}
            >
              Back to My Sheet
            </button>
          ) : (
            <button
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #999", cursor: "pointer", opacity: 0.9 }}
              onClick={unsetMyCharacter}
            >
              Unset “My Character”
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <Tab label="Core" active={activeTab === "core"} onClick={() => setActiveTab("core")} />
        <Tab label="Skills" active={activeTab === "skills"} onClick={() => setActiveTab("skills")} />
        <Tab label="Combat" active={activeTab === "combat"} onClick={() => setActiveTab("combat")} />
        <Tab label="Feats" active={activeTab === "feats"} onClick={() => setActiveTab("feats")} />
        <div style={{ marginLeft: "auto", opacity: 0.8 }}>{isSaving ? "Saving…" : "Synced"}</div>
      </div>

      <div style={{ border: "1px solid #888", borderRadius: 12, padding: 10 }}>
        {activeTab === "core" && (
          <CorePanel sheet={state.sheet} onChange={(partial) => updateSheet((s) => ({ ...s, ...partial }))} />
        )}
        {activeTab === "skills" && (
          <SkillsPanel
  sheet={state.sheet}
  onChange={(skills) => updateSheet((s) => ({ ...s, skills }))}
  onMetaChange={(patch) => updateSheet((s) => ({ ...s, ...patch }))}
 />
        )}
        {activeTab === "combat" && (
          <CombatPanel sheet={state.sheet} tokenId={state.tokenId} onChange={(patch) => updateSheet((s) => ({ ...s, ...patch }))} />
        )}
        {activeTab === "feats" && (
          <FeatsPanel sheet={state.sheet} onChange={(feats) => updateSheet((s) => ({ ...s, feats }))} />
        )}
      </div>
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