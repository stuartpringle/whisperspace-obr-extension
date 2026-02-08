import type { CharacterSheetV1 } from "../../rules/schema";
import { calcDamage } from "../../lib/calcApi";
import { getHookBus } from "../../../packages/core/src/hooks";

export async function applyDamageAndStress(opts: {
  sheet: CharacterSheetV1;
  incomingDamage: number;
  stressDelta?: number;
  unmitigated?: boolean;
}): Promise<{ sheet: CharacterSheetV1; stressDelta: number }> {
  const result = await calcDamage({
    incomingDamage: opts.incomingDamage,
    stressDelta: opts.stressDelta,
    unmitigated: opts.unmitigated,
    armour: opts.sheet.armor,
    wounds: opts.sheet.wounds,
    stress: opts.sheet.stress,
  });
  getHookBus().emit("damage:applied", {
    incomingDamage: Math.max(0, Math.trunc(opts.incomingDamage)),
    unmitigated: opts.unmitigated,
    stressDelta: opts.stressDelta,
    resultingStress: result.stress.current,
  });

  return {
    sheet: {
      ...opts.sheet,
      wounds: result.wounds as any,
      armor: result.armour as any,
      stress: result.stress as any,
    },
    stressDelta: result.stressDelta,
  };
}
