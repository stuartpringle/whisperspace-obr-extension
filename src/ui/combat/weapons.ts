import type { CharacterSheetV1 } from "../../rules/schema";

export function getAmmoMax(w: CharacterSheetV1["weapons"][number] | undefined): number {
  if (!w) return 0;
  const raw = (w.keywordParams as any)?.ammoMax;
  const max = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : undefined;
  return Number.isFinite(max) ? Number(max) : 0;
}
