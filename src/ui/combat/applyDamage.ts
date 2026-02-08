import type { CharacterSheetV1 } from "../../rules/schema";

export function applyDamageAndStress(opts: {
  sheet: CharacterSheetV1;
  incomingDamage: number;
  stressDelta?: number;
  unmitigated?: boolean;
}): { sheet: CharacterSheetV1; stressDelta: number } {
  const incoming = Number.isFinite(opts.incomingDamage) ? Math.max(0, Math.trunc(opts.incomingDamage)) : 0;
  if (incoming <= 0 && !(opts.stressDelta && opts.stressDelta > 0)) {
    return { sheet: opts.sheet, stressDelta: 0 };
  }

  const unmitigatedDamage = !!opts.unmitigated;
  const armor = opts.sheet.armor;
  const armorBroken = (armor?.durability?.current ?? 0) <= 0;
  const prot = (unmitigatedDamage || armorBroken) ? 0 : (armor?.protection ?? 0);
  const afterArmor = Math.max(0, incoming - prot);

  // Fill wound track (4 light, 2 moderate, 1 heavy)
  const before = opts.sheet.wounds ?? { light: 0, moderate: 0, heavy: 0 };
  let light = before.light ?? 0;
  let moderate = before.moderate ?? 0;
  let heavy = before.heavy ?? 0;

  let remaining = afterArmor;
  let addedLight = 0, addedModerate = 0, addedHeavy = 0;

  // light
  const lightCap = 4;
  const addL = Math.min(remaining, Math.max(0, lightCap - light));
  light += addL; remaining -= addL; addedLight = addL;

  // moderate
  const modCap = 2;
  const addM = Math.min(remaining, Math.max(0, modCap - moderate));
  moderate += addM; remaining -= addM; addedModerate = addM;

  // heavy
  const heavyCap = 1;
  const addH = Math.min(remaining, Math.max(0, heavyCap - heavy));
  heavy += addH; remaining -= addH; addedHeavy = addH;

  const nextWounds = { light, moderate, heavy };

  // Stress from the highest severity created by this damage
  let stressInc = 0;
  if (addedHeavy > 0) stressInc = 4;
  else if (addedModerate > 0) stressInc = 2;
  else if (addedLight > 0) stressInc = 1;

  if (opts.stressDelta && opts.stressDelta > 0) {
    stressInc += Math.trunc(opts.stressDelta);
  }

  // Armor durability loss (only if damage gets through, not unmitigated, and armor isn't already broken)
  let nextArmor = armor;
  if (!unmitigatedDamage && !armorBroken && afterArmor > 0 && armor?.durability) {
    nextArmor = {
      ...armor,
      durability: {
        ...armor.durability,
        current: Math.max(0, Math.trunc((armor.durability.current ?? 0) - 1)),
      },
    };
  }

  const nextStress = Math.max(0, Math.trunc((opts.sheet.stress?.current ?? 0) + stressInc));

  return {
    sheet: {
      ...opts.sheet,
      wounds: nextWounds as any,
      armor: nextArmor as any,
      stress: { ...(opts.sheet.stress ?? { current: 0, cuf: 0, cufLoss: 0 }), current: nextStress } as any,
    },
    stressDelta: stressInc,
  };
}
