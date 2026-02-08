export function getAmmoMax(w) {
    if (!w)
        return 0;
    const raw = w.keywordParams?.ammoMax;
    const max = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : undefined;
    return Number.isFinite(max) ? Number(max) : 0;
}
