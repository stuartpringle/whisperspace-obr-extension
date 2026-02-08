import React, { useEffect, useMemo, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { CharacterSheetV1 } from "../rules/schema";
import { ensureSheetOnToken,
  getMyCharacterTokenId,
  getOpenTokenOverride,
  saveSheetToToken,
  setMyCharacterTokenId,
  clearMyOwnedTokenTags,
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
import { InventoryPanel } from "./panels/InventoryPanel";
import { InitiativePanel } from "./panels/InitiativePanel";
import { COMBAT_LOG_CHANNEL, type CombatLogPayload } from "./combat/weaponAttack";
import { applyDamageAndStress } from "./combat/applyDamage";

import { skillsData } from "../data/skills";
import type { SkillDef } from "../data/types";
import { deriveAttributesFromSkills, deriveCUFFromSkills } from "../rules/deriveAttributes";
import { mergeStatusDeltas } from "../rules/statusEffects";
import { rollWithDicePlus, DICEPLUS_SOURCE } from "./diceplus/roll";

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
      ownerPlayerId?: string | null;
      isOwnedByMe?: boolean;
      suppressUnset?: boolean;
    }
  | { kind: "error"; message: string };

export function SheetApp() {
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [activeTab, setActiveTab] = useState<"core" | "skills" | "combat" | "initiative" | "inventory" | "feats">("core");
  const [isSaving, setIsSaving] = useState(false);
  const [crucible, setCrucible] = useState<null | { incoming: number; dc: number; status: "pending" | "success" | "fail"; total?: number }>(null);
  const [isGM, setIsGM] = useState(false);
  const [combatLog, setCombatLog] = useState<CombatLogPayload[]>([]);

  async function getTokenHeaderMeta(tokenId: string): Promise<{ ownerLabel: string; thumbUrl: string | null; ownerPlayerId?: string | null; isOwnedByMe?: boolean }> {
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
        return { ownerLabel: "unowned", thumbUrl, ownerPlayerId: null, isOwnedByMe: false };
      }

      const myId = await OBR.player.getId();
      if (ownerPlayerId === myId) return { ownerLabel: "owned by you", thumbUrl, ownerPlayerId, isOwnedByMe: true };

      // Try to resolve to a friendly name via party players
      try {
        const players: any[] = (await (OBR.party as any).getPlayers?.()) ?? [];
        const p = players.find((x) => x?.id === ownerPlayerId);
        const name = typeof p?.name === "string" && p.name.length > 0 ? p.name : ownerPlayerId;
        return { ownerLabel: `owned by ${name}`, thumbUrl, ownerPlayerId, isOwnedByMe: false };
      } catch {
        return { ownerLabel: `owned by ${ownerPlayerId}`, thumbUrl, ownerPlayerId, isOwnedByMe: false };
      }
    } catch {
      return { ownerLabel: "unowned", thumbUrl: null, ownerPlayerId: null, isOwnedByMe: false };
    }
  }

  // NOTE: this is best-effort; if a token has no ownership metadata or image, we fall back gracefully.

  async function load(opts?: { ignoreOpenOverride?: boolean; suppressUnset?: boolean }) {
    const openTokenId = opts?.ignoreOpenOverride ? null : await getOpenTokenOverride();
    if (openTokenId) {
      const exists = await itemExists(openTokenId);
      if (exists) {
        const sheet = await ensureSheetOnToken(openTokenId);
        if (!sheet) throw new Error("Could not load sheet from token.");
        // Ensure attributes are derived on load as well (in case older tokens stored stale values)
        const derived = deriveAttributesFromSkills(sheet.skills ?? {});
        const fixed: CharacterSheetV1 = { ...sheet, attributes: derived };
        const header = await getTokenHeaderMeta(openTokenId);
        setState({ kind: "ready", tokenId: openTokenId, sheet: fixed, mode: "view", suppressUnset: true, ...header });
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
    setState({ kind: "ready", tokenId: resolvedMyTokenId, sheet: fixed, mode: "my", suppressUnset: !!opts?.suppressUnset, ...header });
  }

  useEffect(() => {
    let cancelled = false;
    OBR.onReady(async () => {
      try {
        const role = await OBR.player.getRole();
        if (!cancelled) setIsGM(String(role).toUpperCase() === "GM");
        await load();
      } catch (e) {
        if (!cancelled) setState({ kind: "error", message: (e as Error).message ?? "Unknown error" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    OBR.onReady(() => {
      if (cancelled) return;
      unsub = OBR.broadcast.onMessage(COMBAT_LOG_CHANNEL, (event) => {
        const data = event.data as CombatLogPayload;
        if (!data?.text) return;
        setCombatLog((prev) => {
          const next = [...prev, data].slice(-3);
          return next;
        });
      });
    });
    return () => {
      cancelled = true;
      if (typeof unsub === "function") {
        try { unsub(); } catch { /* ignore */ }
      }
    };
  }, []);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let intervalId: number | null = null;
    let cancelled = false;
    const KEY = "whisperspace.combatLogLeader";
    const HEARTBEAT_MS = 2000;
    const STALE_MS = 6000;
    const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const readLeader = () => {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };

    const writeLeader = (tsOverride?: number) => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ id: instanceId, ts: tsOverride ?? Date.now() }));
      } catch {
        // If localStorage isn't available, we'll just fall back to local listener.
      }
    };

    const isLeader = () => {
      const cur = readLeader();
      return cur && cur.id === instanceId;
    };

    const maybeClaimLeader = () => {
      const now = Date.now();
      const cur = readLeader();
      if (!cur || (now - (cur.ts ?? 0)) > STALE_MS || cur.id === instanceId) {
        writeLeader(now);
      }
    };

    const ensureSubscription = () => {
      const leader = isLeader();
      if (leader && !unsub) {
        unsub = OBR.broadcast.onMessage(COMBAT_LOG_CHANNEL, (event) => {
          const data = event.data as any;
          if (data?.text) {
            void OBR.notification.show(String(data.text), "INFO");
          }
        });
      } else if (!leader && unsub) {
        try { unsub(); } catch { /* ignore */ }
        unsub = null;
      }
    };

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === KEY) ensureSubscription();
    };

    OBR.onReady(() => {
      if (cancelled) return;
      try {
        window.addEventListener("storage", onStorage);
      } catch {
        // ignore
      }

      maybeClaimLeader();
      ensureSubscription();

      intervalId = window.setInterval(() => {
        if (cancelled) return;
        maybeClaimLeader();
        ensureSubscription();
      }, HEARTBEAT_MS);
    });

    return () => {
      cancelled = true;
      try { window.removeEventListener("storage", onStorage); } catch { /* ignore */ }
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      if (isLeader()) {
        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      }
      if (typeof unsub === "function") {
        try { unsub(); } catch { /* ignore */ }
      }
    };
  }, []);

  function appendEffectLog(targetName: string, damageApplied: number, stressApplied: number) {
    const payload: CombatLogPayload = {
      text: `${targetName} took ${damageApplied} damage${stressApplied ? ` and +${stressApplied} stress` : ""}.`,
      ts: Date.now(),
      kind: "effect",
      targetName,
      damageApplied,
      stressApplied,
    };
    setCombatLog((prev) => [...prev, payload].slice(-3));
  }

  function applyCombatLog(entry: CombatLogPayload) {
    if (state.kind !== "ready") return;
    if (state.mode !== "my") return;
    const damage = Math.max(0, Math.trunc(entry.damageApplied ?? 0));
    const stress = Math.max(0, Math.trunc(entry.stressApplied ?? 0));
    if (damage <= 0 && stress <= 0) return;

    updateSheet((s) =>
      applyDamageAndStress({
        sheet: s,
        incomingDamage: damage,
        stressDelta: stress,
      })
    );

    appendEffectLog(state.sheet.name || "Target", damage, stress);
  }

  // Keep sheet name in sync with token text (Edit Text in OBR)
  useEffect(() => {
    if (state.kind !== "ready") return;
    const tokenId = state.tokenId;
    let cancelled = false;

    const syncFromToken = async () => {
      try {
        const items = await OBR.scene.items.getItems([tokenId]);
        const item: any = items?.[0];
        const tokenName = String(item?.text?.plainText ?? "").trim();
        const thumbUrl = item?.image?.url as string | undefined;

        if (cancelled) return;
        if (!tokenName && !thumbUrl) return;

        setState((prev) => {
          if (prev.kind !== "ready" || prev.tokenId !== tokenId) return prev;
          const nextSheet = tokenName && prev.sheet.name !== tokenName ? { ...prev.sheet, name: tokenName } : prev.sheet;
          return {
            ...prev,
            sheet: nextSheet,
            thumbUrl: thumbUrl ?? prev.thumbUrl
          } as any;
        });
      } catch {
        // ignore
      }
    };

    void syncFromToken();

    const unsub = (OBR as any)?.scene?.items?.onChange?.((items: any[]) => {
      if (!Array.isArray(items)) return;
      if (!items.some((it) => it?.id === tokenId)) return;
      void syncFromToken();
    });

    return () => {
      cancelled = true;
      if (typeof unsub === "function") unsub();
    };
  }, [state.kind, state.kind === "ready" ? state.tokenId : null]);

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
    setState({ kind: "ready", tokenId: selectedId, sheet: fixed, mode: "my", suppressUnset: false, ...header });
  }

  async function unsetMyCharacter() {
    await setMyCharacterTokenId(null);
    try { await clearMyOwnedTokenTags(); } catch {}
    setState({ kind: "need-token" });
  }

  async function backToMySheet() {
    await setOpenTokenOverride(null);
    setState({ kind: "loading" });
    try {
      await load({ ignoreOpenOverride: true, suppressUnset: true });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message ?? "Unknown error" });
    }
  }

  async function saveToToken(tokenId: string, next: CharacterSheetV1) {
    setIsSaving(true);
    try {
      await saveSheetToToken(tokenId, next);
    } finally {
      setIsSaving(false);
    }
  }

  function updateSheet(mutator: (s: CharacterSheetV1) => CharacterSheetV1) {
    setState((prev) => {
      if (prev.kind !== "ready") return prev;
      let next = mutator(prev.sheet);

      // Keep derived fields in-sync as the user changes skills.
      // (Previously these only updated on initial load, requiring a reopen.)
      try {
        const derivedAttrs = deriveAttributesFromSkills(next.skills ?? {});
        next = {
          ...next,
          attributes: { ...next.attributes, ...derivedAttrs },
          stress: { ...(next.stress ?? { current: 0, cuf: 0, cufLoss: 0 }), cuf: deriveCUFFromSkills(next.skills ?? {}) },
        };
      } catch {
        // If anything goes wrong here, fail open (do not block the update).
      }

      // Optimistic update: return next immediately, then persist to token metadata.
      void saveToToken(prev.tokenId, next);

      return {
        ...prev,
        sheet: next,
      };
    });
  }

async function rollCrucibleTest(incoming: number) {
  if (state.kind !== "ready") return;
  const dc = 8 + incoming;
  const cuf = Math.max(0, Math.trunc(state.sheet.stress?.cuf ?? 0));
  const rollLabel = `Crucible Test (DC ${dc})`;
  const modSuffix = cuf === 0 ? "" : ` +${cuf}`;
  const diceNotation = `1d12 # ${rollLabel}${modSuffix}`;

  // Ask Dice+ to roll, then wait for a roll-result so we can decide success/fail.
  const rollId = await rollWithDicePlus({ diceNotation, rollTarget: "everyone", showResults: true });

  const total = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error("Dice+ roll timed out (no roll-result received)"));
    }, 4000);

    const unsub = OBR.broadcast.onMessage(`${DICEPLUS_SOURCE}/roll-result`, (event) => {
      const data: any = event.data;
      if (!data || data.rollId !== rollId) return;

      clearTimeout(timeout);
      unsub();

      const t =
        typeof data.total === "number"
          ? data.total
          : typeof data?.result?.total === "number"
            ? data.result.total
            : typeof data?.value === "number"
              ? data.value
              : NaN;

      if (!Number.isFinite(t)) {
        reject(new Error("Dice+ roll-result received, but total was missing/invalid."));
        return;
      }

      resolve(Math.trunc(t));
    });
  });

  if (total >= dc) {
    // Success: clamp stress to 5 and prompt Indomitable.
    updateSheet((s) => ({
      ...s,
      stress: { ...(s.stress ?? { current: 0, cuf: 0, cufLoss: 0 }), current: 5 },
      indomitable: true,
    }));
    setCrucible({ incoming, dc, status: "success", total });
  } else {
    setCrucible({ incoming, dc, status: "fail", total });
  }
}

function applyStress(nextStress: number) {
  if (state.kind !== "ready") return;
  const prev = Math.max(0, Math.trunc(state.sheet.stress?.current ?? 0));
  const next = Math.max(0, Math.trunc(nextStress));

  // If stress crosses from <=5 to >5, trigger Crucible prompt (incoming = delta).
  if (prev <= 5 && next > 5) {
    const incoming = next - prev;
    setCrucible({ incoming, dc: 8 + incoming, status: "pending" });
  } else {
    setCrucible(null);
  }

  updateSheet((s) => ({
    ...s,
    stress: { ...(s.stress ?? { current: 0, cuf: 0, cufLoss: 0 }), current: next },
  }));
}

function toggleWound(kind: "light" | "moderate" | "heavy", idx: number) {
  if (state.kind !== "ready") return;
  const maxByKind = { light: 4, moderate: 2, heavy: 1 } as const;
  const max = maxByKind[kind];
  const cur = Math.max(0, Math.trunc((state.sheet.wounds as any)?.[kind] ?? 0));
  const next = idx < cur ? idx : idx + 1;
  updateSheet((s) => ({
    ...s,
    wounds: { ...(s.wounds as any), [kind]: Math.min(max, Math.max(0, next)) } as any,
  }));
}

function burnCufToPass() {
  if (state.kind !== "ready" || !crucible || crucible.status !== "fail") return;
  const curLoss = Math.max(0, Math.trunc(state.sheet.stress?.cufLoss ?? 0));
  updateSheet((s) => ({
    ...s,
    stress: { ...(s.stress ?? { current: 0, cuf: 0, cufLoss: 0 }), cufLoss: curLoss + 1, current: 5 },
    indomitable: true,
  }));
  setCrucible({ ...crucible, status: "success" });
}

  // --- Derived stats / encumbrance (including status effects) ---
  // NOTE: these use hooks, so they MUST be above any early returns.
  const readySheet = state.kind === "ready" ? state.sheet : null;
  const statusDeltas = React.useMemo(() => {
    if (!readySheet) return {};
    // Collect all raw status strings and let the helper parse + merge.
    const raws: string[] = [];
    // Feats
    (readySheet.feats ?? []).forEach((f: any) => {
      if (typeof f?.statusEffects === "string" && f.statusEffects.trim()) raws.push(f.statusEffects);
    });
    // Inventory items
    (readySheet.inventory ?? []).forEach((it: any) => {
      if (typeof it?.statusEffects === "string" && it.statusEffects.trim()) raws.push(it.statusEffects);
    });

    return mergeStatusDeltas(raws);
  }, [readySheet]);

  // Map status effects like "stealth+1" or "melee_(sharp)-1" to skill IDs.
  const statusSkillMods = React.useMemo(() => {
    const out: Record<string, number> = {};
    const lookup = new Map<string, string>();

    const addSkill = (s: SkillDef) => {
      const id = String(s.id);
      // Skill keys use snake_case. We accept either an id or the normalized label.
      const nameKey = String((s as any).name ?? (s as any).label ?? "")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_\-()]/g, "");
      if (!id) return;
      lookup.set(id.toLowerCase(), id);
      if (nameKey) lookup.set(nameKey, id);
    };

    // Inherent skills (flat array)
    (skillsData.inherent ?? []).forEach(addSkill);

    // Learned skills (grouped by focus)
    (Object.values(skillsData.learned ?? {}) as SkillDef[][]).forEach((arr) => {
      (arr ?? []).forEach(addSkill);
    });

    const reserved = new Set([
      "phys",
      "ref",
      "soc",
      "ment",
      "carrying_capacity",
      "cool_under_fire",
      "speed",
      "cuf",
      "carry",
      "capacity",
      "spd",
    ]);

    Object.entries(statusDeltas ?? {}).forEach(([rawKey, delta]) => {
      const k = String(rawKey).toLowerCase();
      if (reserved.has(k)) return;
      const skillId = lookup.get(k);
      if (!skillId) return;
      out[skillId] = (out[skillId] ?? 0) + (Number.isFinite(delta) ? (delta as number) : 0);
    });

    return out;
  }, [statusDeltas]);

  const effectivePhys = Math.max(0, (readySheet?.attributes?.phys ?? 0) + (statusDeltas.phys ?? 0));
  const effectiveRef = Math.max(0, (readySheet?.attributes?.ref ?? 0) + (statusDeltas.ref ?? 0));
  const effectiveSoc = Math.max(0, (readySheet?.attributes?.soc ?? 0) + (statusDeltas.soc ?? 0));
  const effectiveMent = Math.max(0, (readySheet?.attributes?.ment ?? 0) + (statusDeltas.ment ?? 0));

  const baseCarryingCapacity = 5 + effectivePhys * 5;
  const effectiveCarryingCapacity = baseCarryingCapacity + (statusDeltas.carrying_capacity ?? 0);
  const baseSpeed = 30 + effectivePhys * 5;
  const effectiveSpeed = baseSpeed + (statusDeltas.speed ?? 0);

  const baseCUF = readySheet ? deriveCUFFromSkills(readySheet.skills ?? {}) : 0;
  const effectiveCUF = Math.max(0, baseCUF + (statusDeltas.cool_under_fire ?? 0));

  // A display-only view of the sheet after applying status effect deltas.
  const viewSheet = React.useMemo<CharacterSheetV1 | null>(() => {
    if (!readySheet) return null;
    return {
      ...readySheet,
      attributes: {
        ...readySheet.attributes,
        phys: effectivePhys,
        ref: effectiveRef,
        soc: effectiveSoc,
        ment: effectiveMent,
      },
      stress: {
        ...(readySheet.stress ?? { current: 0, cuf: 0, cufLoss: 0 }),
        cuf: effectiveCUF,
      },
    };
  }, [readySheet, effectivePhys, effectiveRef, effectiveSoc, effectiveMent, effectiveCUF]);

  const sheetForView = (viewSheet ?? readySheet) as CharacterSheetV1 | null;

  const totalBulk = React.useMemo(() => {
    if (!readySheet) return 0;
    const weaponsBulk = (readySheet.weapons ?? []).reduce((sum, w) => sum + (w.bulk ?? 0), 0);
    const armorBulk = (readySheet.armor?.bulk ?? 0);
    const invBulk = (readySheet.inventory ?? []).reduce((sum, it) => {
      const qty = (it as any).quantity ?? 1;
      const bulk = (it as any).bulk ?? 0;
      const b = Number.isFinite(bulk) ? bulk : 0;
      const q = Number.isFinite(qty) ? qty : 1;
      return sum + b * q;
    }, 0);
    return weaponsBulk + armorBulk + invBulk;
  }, [readySheet]);

  const encumbranceLabel =
    readySheet && totalBulk > effectiveCarryingCapacity * 2
      ? "Heavily Encumbered"
      : readySheet && totalBulk > effectiveCarryingCapacity
        ? "Encumbered"
        : "";

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
            !state.isOwnedByMe && (
              <button
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #999", cursor: "pointer", opacity: 0.9 }}
                onClick={backToMySheet}
              >
                Back to My Sheet
              </button>
            )
          ) : !state.suppressUnset ? (
            <button
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #999", cursor: "pointer", opacity: 0.9 }}
              onClick={unsetMyCharacter}
            >
              Unset “My Character”
            </button>
          ) : null}
        </div>
      </div>


<>
    {/* Global status (visible on all tabs) */}
    <div style={styles.statusBar}>
      <div style={styles.statusLeft}>
        <div style={styles.statusGroup}>
          <div style={styles.statusLabel}>Stress</div>
          <input
            type="number"
            min={0}
            value={state.sheet.stress?.current ?? 0}
            onChange={(e) => applyStress(Number(e.target.value))}
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
                checked={(state.sheet.wounds?.light ?? 0) > i}
                onChange={() => toggleWound("light", i)}
              />
            ))}
            <span style={{ width: 8 }} />
            <span style={styles.woundsKind}>M</span>
            {Array.from({ length: 2 }).map((_, i) => (
              <input
                key={`wm_${i}`}
                type="checkbox"
                checked={(state.sheet.wounds?.moderate ?? 0) > i}
                onChange={() => toggleWound("moderate", i)}
              />
            ))}
            <span style={{ width: 8 }} />
            <span style={styles.woundsKind}>H</span>
            {Array.from({ length: 1 }).map((_, i) => (
              <input
                key={`wh_${i}`}
                type="checkbox"
                checked={(state.sheet.wounds?.heavy ?? 0) > i}
                onChange={() => toggleWound("heavy", i)}
              />
            ))}
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={!!state.sheet.indomitable}
            onChange={(e) => updateSheet((s) => ({ ...s, indomitable: e.target.checked }))}
          />
          <span style={{ fontSize: 12, opacity: 0.9 }}>Indomitable</span>
        </label>

        {(state.sheet.stress?.current ?? 0) > ((sheetForView ?? state.sheet).stress?.cuf ?? 0) && (
          <div style={styles.warning}>
            Stress &gt; CUF: make all rolls with +1 Penalty Die
          </div>
        )}

        <div style={{ fontSize: 12, opacity: 0.85 }}>
          Bulk: {totalBulk} / {effectiveCarryingCapacity}
        </div>
        {encumbranceLabel && <div style={styles.warning}>{encumbranceLabel}</div>}
      </div>

      <div style={styles.statusRight}>
        {crucible && crucible.status === "pending" && (
          <div style={styles.crucibleBox}>
            <div style={{ fontWeight: 700 }}>Crucible Test!</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Incoming stress: {crucible.incoming} • DC {crucible.dc} • Roll CUF (no bonus/penalty dice)
            </div>
            <button style={styles.buttonSecondary} onClick={() => void rollCrucibleTest(crucible.incoming)}>
              Roll Crucible
            </button>
          </div>
        )}

        {crucible && crucible.status === "success" && (
          <div style={styles.crucibleBox}>
            <div style={{ fontWeight: 700 }}>Crucible succeeded!</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Choose an Indomitable effect. (Indomitable checked automatically.)
            </div>
          </div>
        )}

        {crucible && crucible.status === "fail" && (
          <div style={styles.crucibleBox}>
            <div style={{ fontWeight: 700 }}>Crucible failed</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              You’ve entered PTSD range (6–8 stress).
            </div>
            <button style={styles.buttonSecondary} onClick={burnCufToPass}>
              Spend 1 CUF to pass
            </button>
          </div>
        )}
      </div>
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
      <Tab label="Core" active={activeTab === "core"} onClick={() => setActiveTab("core")} />
      <Tab label="Skills" active={activeTab === "skills"} onClick={() => setActiveTab("skills")} />
      <Tab label="Combat" active={activeTab === "combat"} onClick={() => setActiveTab("combat")} />
      <Tab label="Initiative" active={activeTab === "initiative"} onClick={() => setActiveTab("initiative")} />
      <Tab label="Inventory" active={activeTab === "inventory"} onClick={() => setActiveTab("inventory")} />
      <Tab label="Feats" active={activeTab === "feats"} onClick={() => setActiveTab("feats")} />
      <div style={{ marginLeft: "auto", opacity: 0.8 }}>{isSaving ? "Saving…" : "Synced"}</div>
    </div>

    <div style={{ border: "1px solid #888", borderRadius: 12, padding: 10 }}>
      {activeTab === "core" && (
        <CorePanel sheet={sheetForView as CharacterSheetV1} onChange={(partial) => updateSheet((s) => ({ ...s, ...partial }))} />
      )}
      {activeTab === "skills" && (
        <SkillsPanel
          sheet={sheetForView as CharacterSheetV1}
          skillMods={statusSkillMods}
          onChange={(skills) => updateSheet((s) => ({ ...s, skills }))}
          onMetaChange={(patch) => updateSheet((s) => ({ ...s, ...patch }))}
        />
      )}
        {activeTab === "combat" && (
          <CombatPanel
            sheet={sheetForView as CharacterSheetV1}
            tokenId={state.tokenId}
            skillMods={statusSkillMods}
            onChange={(patch) => updateSheet((s) => ({ ...s, ...patch }))}
            onApplyStress={applyStress}
            combatLog={combatLog}
            onApplyCombatLog={state.mode === "my" ? applyCombatLog : undefined}
            isGM={isGM}
          />
        )}
      {activeTab === "initiative" && <InitiativePanel />}
      {activeTab === "inventory" && (
        <InventoryPanel sheet={sheetForView as CharacterSheetV1} onChange={(patch) => updateSheet((s) => ({ ...s, ...patch }))} />
      )}
      {activeTab === "feats" && (
        <FeatsPanel sheet={sheetForView as CharacterSheetV1} onChange={(feats) => updateSheet((s) => ({ ...s, feats }))} />
      )}
    </div>
  </>
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
