export function getAmmoMax(w: { keywordParams?: Record<string, string | number | boolean> } | undefined): number {
  if (!w) return 0;
  const raw = (w.keywordParams as any)?.ammoMax;
  const max = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : undefined;
  return Number.isFinite(max) ? Number(max) : 0;
}
