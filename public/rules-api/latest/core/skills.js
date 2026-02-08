export function buildLearnedInfoById(learned) {
    const map = new Map();
    Object.keys(learned ?? {}).forEach((focus) => {
        (learned[focus] ?? []).forEach((s) => map.set(s.id, { focus }));
    });
    return map;
}
export function skillModifierFor(opts) {
    const skillId = String(opts.skillId ?? "");
    const rank = (opts.ranks?.[skillId] ?? 0);
    const bonus = opts.skillMods?.[skillId] ?? 0;
    if (rank > 0)
        return rank + bonus;
    const learningFocus = opts.learningFocus ?? "combat";
    const learnedInfo = opts.learnedInfoById.get(skillId);
    const base = learnedInfo && learnedInfo.focus === learningFocus ? 0 : -1;
    return base + bonus;
}
