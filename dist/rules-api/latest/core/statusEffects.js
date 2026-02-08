export function parseStatusEffects(raw) {
    const deltas = {};
    if (!raw)
        return deltas;
    const parts = raw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    for (const part of parts) {
        const m = part.match(/^([a-zA-Z0-9_\-]+)\s*[:]?\s*([+\-])\s*(\d+)$/);
        if (!m)
            continue;
        const key = String(m[1]).toLowerCase().replace(/\s+/g, "_");
        const sign = m[2] === "-" ? -1 : 1;
        const amt = Math.trunc(Number(m[3]));
        if (!Number.isFinite(amt))
            continue;
        deltas[key] = (deltas[key] ?? 0) + sign * amt;
    }
    return deltas;
}
export function mergeStatusDeltas(statuses) {
    const out = {};
    for (const raw of statuses) {
        const m = parseStatusEffects(raw ?? "");
        for (const [k, v] of Object.entries(m)) {
            out[k] = (out[k] ?? 0) + v;
        }
    }
    return out;
}
export function computeStatusEffects(statuses) {
    const deltas = mergeStatusDeltas(statuses);
    return { deltas };
}
export function applyStatusToDerived(derived, deltas) {
    const next = { ...derived };
    const add = (key, val) => {
        if (!Number.isFinite(val) || val === 0)
            return;
        next[key] = (Number(next[key]) || 0) + val;
    };
    add("phys", deltas["phys"] ?? 0);
    add("ref", deltas["ref"] ?? 0);
    add("soc", deltas["soc"] ?? 0);
    add("ment", deltas["ment"] ?? 0);
    add("coolUnderFire", deltas["cool_under_fire"] ?? 0);
    add("speed", deltas["speed"] ?? 0);
    add("carryingCapacity", deltas["carrying_capacity"] ?? 0);
    for (const [k, v] of Object.entries(deltas)) {
        if (k === "phys" || k === "ref" || k === "soc" || k === "ment")
            continue;
        if (k === "cool_under_fire" || k === "speed" || k === "carrying_capacity")
            continue;
        if (typeof next[k] === "number") {
            next[k] = next[k] + v;
        }
    }
    return next;
}
