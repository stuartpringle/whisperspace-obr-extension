export function critExtraForMargin(margin) {
    if (margin >= 9)
        return 4;
    if (margin >= 7)
        return 3;
    if (margin >= 4)
        return 2;
    return 0;
}
export function buildAttackOutcome(opts) {
    const total = Math.trunc(opts.total ?? 0);
    const useDC = Math.trunc(opts.useDC ?? 0);
    const baseDamage = Math.trunc(opts.weaponDamage ?? 0);
    const label = opts.label || "Attack";
    const margin = total - useDC;
    const hit = total >= useDC;
    const critExtra = hit ? critExtraForMargin(margin) : 0;
    const isCrit = hit && critExtra > 0;
    const totalDamage = hit ? baseDamage + critExtra : 0;
    const stressDelta = isCrit ? 1 : 0;
    let message;
    if (!hit) {
        message = `Miss. ${label} rolled ${total} vs DC ${useDC}.`;
    }
    else if (isCrit) {
        message = `Extreme success - crit! ${label} rolled ${total} vs DC ${useDC}. Damage: ${baseDamage}+${critExtra}=${totalDamage}. (+1 Stress)`;
    }
    else {
        message = `Hit. ${label} rolled ${total} vs DC ${useDC}. Damage: ${baseDamage}.`;
    }
    return {
        total,
        useDC,
        margin,
        hit,
        isCrit,
        critExtra,
        baseDamage,
        totalDamage,
        stressDelta,
        message,
    };
}
export function applyDamageAndStressCore(opts) {
    const incoming = Number.isFinite(opts.incomingDamage) ? Math.max(0, Math.trunc(opts.incomingDamage)) : 0;
    if (incoming <= 0 && !(opts.stressDelta && opts.stressDelta > 0)) {
        return {
            wounds: opts.wounds ?? { light: 0, moderate: 0, heavy: 0 },
            armour: opts.armour,
            stress: opts.stress ?? { current: 0, cuf: 0, cufLoss: 0 },
            stressDelta: 0,
        };
    }
    const unmitigatedDamage = !!opts.unmitigated;
    const armour = opts.armour;
    const armourBroken = (armour?.durability?.current ?? 0) <= 0;
    const prot = (unmitigatedDamage || armourBroken) ? 0 : (armour?.protection ?? 0);
    const afterArmour = Math.max(0, incoming - prot);
    const before = opts.wounds ?? { light: 0, moderate: 0, heavy: 0 };
    let light = before.light ?? 0;
    let moderate = before.moderate ?? 0;
    let heavy = before.heavy ?? 0;
    let remaining = afterArmour;
    let addedLight = 0, addedModerate = 0, addedHeavy = 0;
    const lightCap = 4;
    const addL = Math.min(remaining, Math.max(0, lightCap - light));
    light += addL;
    remaining -= addL;
    addedLight = addL;
    const modCap = 2;
    const addM = Math.min(remaining, Math.max(0, modCap - moderate));
    moderate += addM;
    remaining -= addM;
    addedModerate = addM;
    const heavyCap = 1;
    const addH = Math.min(remaining, Math.max(0, heavyCap - heavy));
    heavy += addH;
    remaining -= addH;
    addedHeavy = addH;
    const nextWounds = { light, moderate, heavy };
    let stressInc = 0;
    if (addedHeavy > 0)
        stressInc = 4;
    else if (addedModerate > 0)
        stressInc = 2;
    else if (addedLight > 0)
        stressInc = 1;
    if (opts.stressDelta && opts.stressDelta > 0) {
        stressInc += Math.trunc(opts.stressDelta);
    }
    let nextArmour = armour;
    if (!unmitigatedDamage && !armourBroken && afterArmour > 0 && armour?.durability) {
        nextArmour = {
            ...armour,
            durability: {
                ...armour.durability,
                current: Math.max(0, Math.trunc((armour.durability.current ?? 0) - 1)),
            },
        };
    }
    const nextStress = Math.max(0, Math.trunc((opts.stress?.current ?? 0) + stressInc));
    return {
        wounds: nextWounds,
        armour: nextArmour,
        stress: { ...(opts.stress ?? { current: 0, cuf: 0, cufLoss: 0 }), current: nextStress },
        stressDelta: stressInc,
    };
}
