import OBR from "@owlbear-rodeo/sdk";
import { META_KEY_SHEET, createDefaultSheet, CharacterSheetV1 } from "../rules/schema";
import { migrateToLatest } from "../rules/migrate";

export const EXT_ID = "com.whisperspace.sheet";

export const PLAYER_KEY_MY_TOKEN = `${EXT_ID}/myCharacterTokenId`;
export const PLAYER_KEY_OPEN_TOKEN = `${EXT_ID}/openTokenId`;

export const TOKEN_KEY_OWNER_PLAYER = `${EXT_ID}/ownerPlayerId`;

function isString(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}

export async function getMyCharacterTokenId(): Promise<string | null> {
  const md = await OBR.player.getMetadata();
  const v = md[PLAYER_KEY_MY_TOKEN];
  return isString(v) ? v : null;
}

export async function setMyCharacterTokenId(tokenId: string | null): Promise<void> {
  const md = await OBR.player.getMetadata();
  const next = { ...md };
  if (tokenId) next[PLAYER_KEY_MY_TOKEN] = tokenId;
  else delete next[PLAYER_KEY_MY_TOKEN];
  await OBR.player.setMetadata(next);
}

export async function getOpenTokenOverride(): Promise<string | null> {
  const md = await OBR.player.getMetadata();
  const v = md[PLAYER_KEY_OPEN_TOKEN];
  return isString(v) ? v : null;
}

export async function setOpenTokenOverride(tokenId: string | null): Promise<void> {
  const md = await OBR.player.getMetadata();
  const next = { ...md };
  if (tokenId) next[PLAYER_KEY_OPEN_TOKEN] = tokenId;
  else delete next[PLAYER_KEY_OPEN_TOKEN];
  await OBR.player.setMetadata(next);
}

export async function loadSheetFromToken(tokenId: string): Promise<CharacterSheetV1 | null> {
  const items = await OBR.scene.items.getItems([tokenId]);
  const item = items[0];
  if (!item) return null;

  const raw = item.metadata?.[META_KEY_SHEET];
  if (!raw) return createDefaultSheet(item.name ?? "Unnamed");

  return migrateToLatest(raw);
}

export async function saveSheetToToken(tokenId: string, sheet: CharacterSheetV1): Promise<void> {
  await OBR.scene.items.updateItems([tokenId], (drafts) => {
    const it = drafts[0];
    if (!it) return;
    it.metadata[META_KEY_SHEET] = sheet;
  });
}

export async function tokenHasSheet(tokenId: string): Promise<boolean> {
  const items = await OBR.scene.items.getItems([tokenId]);
  const item = items[0];
  if (!item) return false;
  return !!item.metadata?.[META_KEY_SHEET];
}

export async function ensureSheetOnToken(tokenId: string): Promise<CharacterSheetV1 | null> {
  const existing = await loadSheetFromToken(tokenId);
  if (!existing) return null;

  const has = await tokenHasSheet(tokenId);
  if (!has) await saveSheetToToken(tokenId, existing);

  return existing;
}

export async function tagTokenOwnedByMe(tokenId: string): Promise<void> {
  const myPlayerId = await OBR.player.getId();
  const items = await OBR.scene.items.getItems([tokenId]);
  if (!items[0]) return;

  await OBR.scene.items.updateItems([tokenId], (drafts) => {
    const it = drafts[0];
    if (!it) return;
    it.metadata[TOKEN_KEY_OWNER_PLAYER] = myPlayerId;
  });
}

export async function findMyOwnedTokenId(): Promise<string | null> {
  const myPlayerId = await OBR.player.getId();
  const items = await OBR.scene.items.getItems();
  const mine = items.find((it) => it.metadata?.[TOKEN_KEY_OWNER_PLAYER] === myPlayerId);
  return mine?.id ?? null;
}
