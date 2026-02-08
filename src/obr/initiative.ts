import OBR from "@owlbear-rodeo/sdk";

/**
 * Our own lightweight initiative tracker.
 * Stored in scene metadata so it is shared across all players.
 */

export const INIT_TRACKER_KEY = "whisperspace.obr.sheet/initiativeTracker";
export const INIT_ACTIVE_META_KEY = "whisperspace.obr.sheet/initActive";

export type InitiativeEntry = {
  tokenId: string;
  name: string;
  thumbUrl?: string;
  initiative: number;
  surprised?: boolean;
  updatedAt: number;
};

export type InitiativeTrackerState = {
  entries: InitiativeEntry[];
  activeTokenId?: string;
  updatedAt: number;
};

const emptyState = (): InitiativeTrackerState => ({
  entries: [],
  updatedAt: Date.now(),
});

function sortEntries(entries: InitiativeEntry[]) {
  return [...entries].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
}

export async function getInitiativeState(): Promise<InitiativeTrackerState> {
  const meta = await OBR.scene.getMetadata();
  const raw = (meta as any)?.[INIT_TRACKER_KEY];
  if (!raw || typeof raw !== "object") return emptyState();

  const entriesRaw = Array.isArray((raw as any).entries) ? (raw as any).entries : [];
  const entries: InitiativeEntry[] = entriesRaw
    .filter((e: any) => e && typeof e.tokenId === "string")
    .map((e: any) => ({
      tokenId: String(e.tokenId),
      name: typeof e.name === "string" ? e.name : "Unnamed",
      thumbUrl: typeof e.thumbUrl === "string" ? e.thumbUrl : undefined,
      initiative: Number.isFinite(e.initiative) ? Math.trunc(e.initiative) : 0,
      surprised: typeof e.surprised === "boolean" ? e.surprised : false,
      updatedAt: Number.isFinite(e.updatedAt) ? Math.trunc(e.updatedAt) : 0,
    }));

  const state: InitiativeTrackerState = {
    entries: sortEntries(entries),
    activeTokenId: typeof (raw as any).activeTokenId === "string" ? (raw as any).activeTokenId : undefined,
    updatedAt: Number.isFinite((raw as any).updatedAt) ? Math.trunc((raw as any).updatedAt) : Date.now(),
  };

  if (state.entries.length > 0 && (!state.activeTokenId || !state.entries.some((e) => e.tokenId === state.activeTokenId))) {
    state.activeTokenId = state.entries[0].tokenId;
  }

  return state;
}

async function setInitiativeState(state: InitiativeTrackerState) {
  await OBR.scene.setMetadata({
    [INIT_TRACKER_KEY]: state,
  });
}

async function markActiveToken(activeTokenId?: string, tokenIds: string[] = []) {
  if (!tokenIds.length) return;
  const ids = Array.from(new Set(tokenIds));
  try {
    await OBR.scene.items.updateItems(ids, (items) => {
      for (const it of items) {
        const nextMeta = { ...(it.metadata ?? {}) } as any;
        nextMeta[INIT_ACTIVE_META_KEY] = activeTokenId ? it.id === activeTokenId : false;
        it.metadata = nextMeta;
      }
    });
  } catch {
    // Best-effort only.
  }
}

export async function upsertInitiativeEntry(entry: Omit<InitiativeEntry, "updatedAt"> & { updatedAt?: number }) {
  const cur = await getInitiativeState();
  const now = entry.updatedAt ?? Date.now();

  const nextEntries = cur.entries.filter((e) => e.tokenId !== entry.tokenId);
  nextEntries.push({
    tokenId: entry.tokenId,
    name: entry.name,
    thumbUrl: entry.thumbUrl,
    initiative: Math.trunc(entry.initiative),
    updatedAt: now,
  });

  const sorted = sortEntries(nextEntries);
  const next: InitiativeTrackerState = {
    entries: sorted,
    activeTokenId: cur.activeTokenId,
    updatedAt: Date.now(),
  };

  if (sorted.length > 0 && (!next.activeTokenId || !sorted.some((e) => e.tokenId === next.activeTokenId))) {
    next.activeTokenId = sorted[0].tokenId;
  }

  await setInitiativeState(next);
  await markActiveToken(next.activeTokenId, sorted.map((e) => e.tokenId));
  return next;
}

export async function clearInitiative() {
  const next = emptyState();
  await setInitiativeState(next);
}

export async function removeFromInitiative(tokenId: string) {
  const cur = await getInitiativeState();
  const remaining = (cur.entries ?? []).filter((e) => e.tokenId !== tokenId);
  let active = cur.activeTokenId;
  if (active === tokenId) {
    const sorted = sortEntries(remaining);
    active = sorted.length ? sorted[0].tokenId : undefined;
  }
  const next: InitiativeTrackerState = {
    entries: remaining,
    activeTokenId: active,
    updatedAt: Date.now(),
  };
  await setInitiativeState(next);
  await markActiveToken(next.activeTokenId, remaining.map((e) => e.tokenId));
  return next;
}

// Back-compat: older UI imports used this name.
export const removeInitiativeEntry = removeFromInitiative;

export async function setSurprised(tokenId: string, surprised: boolean) {
  const cur = await getInitiativeState();
  const nextEntries = (cur.entries ?? []).map((e) =>
    e.tokenId === tokenId ? { ...e, surprised: !!surprised } : e
  );
  const next: InitiativeTrackerState = {
    entries: sortEntries(nextEntries),
    activeTokenId: cur.activeTokenId,
    updatedAt: Date.now(),
  };
  await setInitiativeState(next);
  await markActiveToken(next.activeTokenId, nextEntries.map((e) => e.tokenId));
  return next;
}

export async function advanceInitiative() {
  const cur = await getInitiativeState();
  const sorted = sortEntries(cur.entries);
  if (sorted.length === 0) return cur;

  const idx = cur.activeTokenId ? sorted.findIndex((e) => e.tokenId === cur.activeTokenId) : -1;
  const nextIdx = idx >= 0 ? (idx + 1) % sorted.length : 0;
  const wrapped = idx >= 0 && nextIdx === 0;
  const nextEntries = wrapped ? sorted.map((e) => ({ ...e, surprised: false })) : sorted;

  const next: InitiativeTrackerState = {
    entries: nextEntries,
    activeTokenId: nextEntries[nextIdx].tokenId,
    updatedAt: Date.now(),
  };

  await setInitiativeState(next);
  await markActiveToken(next.activeTokenId, nextEntries.map((e) => e.tokenId));
  return next;
}

export function onInitiativeChange(callback: (state: InitiativeTrackerState) => void) {
  const unsub = OBR.scene.onMetadataChange(() => {
    void getInitiativeState().then(callback);
  });

  void getInitiativeState().then(callback);
  return unsub;
}
