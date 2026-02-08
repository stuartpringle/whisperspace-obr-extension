import OBR from "@owlbear-rodeo/sdk";

export async function getSelectionIds(): Promise<string[]> {
  const ids = await OBR.player.getSelection();
  return Array.isArray(ids) ? ids : [];
}

export async function getFirstSelectedId(): Promise<string | null> {
  const ids = await getSelectionIds();
  return ids.length > 0 ? ids[0] : null;
}

export async function itemExists(id: string): Promise<boolean> {
  const items = await OBR.scene.items.getItems([id]);
  return items.length > 0;
}
