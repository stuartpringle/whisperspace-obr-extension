import OBR from "@owlbear-rodeo/sdk";
import { buildWhisperspaceSkillNotation, rollWithDicePlusTotal } from "../diceplus/roll";

// Shared broadcast channel for derived combat messages (hit/miss, damage, crits, etc.)
export const COMBAT_LOG_CHANNEL = "whisperspace.obr.sheet/combat-log";

export type WeaponForAttack = {
  name: string;
  skillId: string;
  useDC: number;
  damage: number;
  ammo?: number;
  keywordParams?: Record<string, string | number | boolean>;
};

export type AttackOutcome = {
  total: number;
  useDC: number;
  margin: number;
  hit: boolean;
  isCrit: boolean;
  critExtra: number;
  baseDamage: number;
  totalDamage: number;
  message: string;
};

function critExtraForMargin(margin: number): number {
  if (margin >= 9) return 4;
  if (margin >= 7) return 3;
  if (margin >= 4) return 2;
  return 0;
}

/**
 * Performs a weapon attack roll (Dice+) and broadcasts a Whisperspace-formatted combat message.
 * This is the single source of truth used by both Combat tab and Initiative tab.
 */
export async function rollWeaponAttack(opts: {
  weapon: WeaponForAttack;
  // netDice: +N means bonus dice, -N means penalty dice (already cancelled)
  netDice: number;
  modifier: number; // skill modifier to add to the roll
  rollTarget?: "everyone" | "self" | "dm" | "gm_only";
  showResults?: boolean;
  // Optional DC override (e.g., cover). Defaults to weapon.useDC
  useDC?: number;
  // Optional prefix to help identify source (e.g., "(Initiative)")
  prefix?: string;
}): Promise<AttackOutcome> {
  const useDC = Number.isFinite(opts.useDC) ? Math.trunc(opts.useDC!) : Math.trunc(opts.weapon.useDC);
  const label = opts.weapon.name || "Attack";

  const diceNotation = buildWhisperspaceSkillNotation({
    netDice: opts.netDice,
    modifier: opts.modifier,
    label,
  });

  const total = await rollWithDicePlusTotal({
    diceNotation,
    rollTarget: opts.rollTarget ?? "everyone",
    showResults: opts.showResults ?? true,
  });

  const margin = total - useDC;
  const hit = total >= useDC;
  const critExtra = hit ? critExtraForMargin(margin) : 0;
  const isCrit = hit && critExtra > 0;

  const baseDamage = Math.trunc(opts.weapon.damage ?? 0);
  const totalDamage = hit ? baseDamage + critExtra : 0;

  let msg: string;
  if (!hit) {
    msg = `Miss. ${label} rolled ${total} vs DC ${useDC}.`;
  } else if (isCrit) {
    msg = `Extreme success - crit! ${label} rolled ${total} vs DC ${useDC}. Damage: ${baseDamage}+${critExtra}=${totalDamage}. (+1 Stress)`;
  } else {
    msg = `Hit. ${label} rolled ${total} vs DC ${useDC}. Damage: ${baseDamage}.`;
  }

  if (opts.prefix) msg = `${opts.prefix} ${msg}`;

  void OBR.broadcast.sendMessage(COMBAT_LOG_CHANNEL, { text: msg, ts: Date.now() }, { destination: "ALL" });

  return {
    total,
    useDC,
    margin,
    hit,
    isCrit,
    critExtra,
    baseDamage,
    totalDamage,
    message: msg,
  };
}

// Back-compat alias used by some panels.
export const rollWeaponAttackAndBroadcast = rollWeaponAttack;
