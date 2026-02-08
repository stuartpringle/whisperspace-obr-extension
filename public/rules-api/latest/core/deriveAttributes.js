/**
 * Attributes are derived from the sum of skill ranks beneath them.
 * Current rule: Attribute = ceil((sum of ranks) / 4)
 *
 * NOTE: This expects only inherent skills are included in `inherentSkills`.
 */
export function deriveAttributesFromSkills(skills, inherentSkills) {
    const sums = { phys: 0, ref: 0, soc: 0, ment: 0 };
    for (const s of inherentSkills) {
        const rank = Number(skills?.[s.id] ?? 0);
        const attr = s.attribute;
        if (attr && attr in sums) {
            sums[attr] += Math.max(0, rank);
        }
    }
    return {
        phys: Math.max(0, Math.ceil(sums.phys / 4)),
        ref: Math.max(0, Math.ceil(sums.ref / 4)),
        soc: Math.max(0, Math.ceil(sums.soc / 4)),
        ment: Math.max(0, Math.ceil(sums.ment / 4)),
    };
}
export function deriveCUFFromSkills(skills) {
    const ids = ["instinct", "willpower", "bearing", "toughness", "tactics"];
    const sum = ids.reduce((acc, id) => acc + Math.max(0, Math.trunc(Number(skills[id] ?? 0))), 0);
    return 1 + Math.ceil(sum / 5);
}
