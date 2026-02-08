import OBR from "@owlbear-rodeo/sdk";
import { rollWithDicePlusTotal } from "../diceplus/roll";
import { calcAttack, calcSkillNotation, type CalcAttackOutcome } from "../../@whisperspace/sdk";
import { getHookBus } from "../../../packages/core/src/hooks";

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

export type AttackOutcome = CalcAttackOutcome;

export type CombatLogPayload = {
  text: string;
  ts: number;
  kind?: "attack" | "effect";
  attackerName?: string;
  weaponName?: string;
  targetName?: string;
  damageApplied?: number;
  stressApplied?: number;
  outcome?: Pick<AttackOutcome, "total" | "useDC" | "hit" | "isCrit" | "baseDamage" | "totalDamage" | "stressDelta">;
};

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
  attackerName?: string;
}): Promise<AttackOutcome> {
  const useDC = Number.isFinite(opts.useDC) ? Math.trunc(opts.useDC!) : Math.trunc(opts.weapon.useDC);
  const label = opts.weapon.name || "Attack";

  const diceNotation = (await calcSkillNotation({
    netDice: opts.netDice,
    modifier: opts.modifier,
    label,
  })).notation;

  const total = await rollWithDicePlusTotal({
    diceNotation,
    rollTarget: opts.rollTarget ?? "everyone",
    showResults: opts.showResults ?? true,
  });

  const outcome = await calcAttack({
    total,
    useDC,
    weaponDamage: Math.trunc(opts.weapon.damage ?? 0),
    label,
  });
  getHookBus().emit("attack:resolved", {
    total: outcome.total,
    useDC: outcome.useDC,
    hit: outcome.hit,
    isCrit: outcome.isCrit,
    baseDamage: outcome.baseDamage,
    totalDamage: outcome.totalDamage,
    stressDelta: outcome.stressDelta,
    label,
  });

  let msg = outcome.message;
  if (opts.prefix) msg = `${opts.prefix} ${msg}`;

  const payload: CombatLogPayload = {
    text: msg,
    ts: Date.now(),
    kind: "attack",
    attackerName: opts.attackerName,
    weaponName: label,
    outcome: {
      total: outcome.total,
      useDC: outcome.useDC,
      hit: outcome.hit,
      isCrit: outcome.isCrit,
      baseDamage: outcome.baseDamage,
      totalDamage: outcome.totalDamage,
      stressDelta: outcome.stressDelta,
    },
  };
  void OBR.broadcast.sendMessage(COMBAT_LOG_CHANNEL, payload, { destination: "ALL" });

  return {
    ...outcome,
    message: msg,
  };
}

// Back-compat alias used by some panels.
export const rollWeaponAttackAndBroadcast = rollWeaponAttack;
