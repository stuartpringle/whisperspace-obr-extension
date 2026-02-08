import OBR from "@owlbear-rodeo/sdk";

/**
 * Owlbear's official Initiative Tracker stores initiative on the ITEM (token) metadata under:
 *   item.metadata[`${INITIATIVE_TRACKER_ID}/metadata`] = { initiative: number | string }
 *
 * Important: `OBR.scene.items.updateItems` expects either:
 *   - a filter function, OR
 *   - an array of *Item objects* (NOT ids).
 *
 * So we `getItems([id])` first, then `updateItems(items, ...)`.
 *
 * Docs: https://docs.owlbear.rodeo/extensions/apis/scene/items/
 */
export const INITIATIVE_TRACKER_ID = "com.owlbear-rodeo.initiative-tracker";
export const INITIATIVE_METADATA_KEY = `${INITIATIVE_TRACKER_ID}/metadata`;

export async function setTokenInitiative(tokenId: string, initiative: number) {
  const value = Number.isFinite(initiative) ? Math.trunc(initiative) : 0;

  const items = await OBR.scene.items.getItems([tokenId]);
  if (!items.length) return;

  await OBR.scene.items.updateItems(items, (draft) => {
    for (const item of draft) {
      item.metadata[INITIATIVE_METADATA_KEY] = { initiative: value };
    }
  });
}

export async function clearTokenInitiative(tokenId: string) {
  const items = await OBR.scene.items.getItems([tokenId]);
  if (!items.length) return;

  await OBR.scene.items.updateItems(items, (draft) => {
    for (const item of draft) {
      delete item.metadata[INITIATIVE_METADATA_KEY];
    }
  });
}
