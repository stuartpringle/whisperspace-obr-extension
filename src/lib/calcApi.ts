import { CALC_API_BASE } from "../config";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${CALC_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Calc API error ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export type CalcAttackOutcome = {
  total: number;
  useDC: number;
  margin: number;
  hit: boolean;
  isCrit: boolean;
  critExtra: number;
  baseDamage: number;
  totalDamage: number;
  stressDelta: number;
  message: string;
};

export async function calcAttack(opts: {
  total: number;
  useDC: number;
  weaponDamage: number;
  label?: string;
}): Promise<CalcAttackOutcome> {
  return postJson<CalcAttackOutcome>("/attack", opts);
}

export async function calcCritExtra(opts: { margin: number }): Promise<{ critExtra: number }> {
  return postJson("/crit-extra", opts);
}

export async function calcDamage(opts: {
  incomingDamage: number;
  stressDelta?: number;
  unmitigated?: boolean;
  armour?: any;
  wounds?: any;
  stress?: any;
}): Promise<{ wounds: any; armour?: any; stress: any; stressDelta: number }> {
  return postJson("/damage", opts);
}

export async function calcDeriveAttributes(opts: {
  skills: Record<string, number>;
  inherentSkills: Array<{ id: string; attribute: "phys" | "ref" | "soc" | "ment" }>;
}): Promise<{ phys: number; ref: number; soc: number; ment: number }> {
  return postJson("/derive-attributes", opts);
}

export async function calcDeriveCuf(opts: { skills: Record<string, number> }): Promise<{ cuf: number }> {
  return postJson("/derive-cuf", opts);
}

export async function calcSkillNotation(opts: {
  netDice: number;
  modifier: number;
  label: string;
}): Promise<{ notation: string }> {
  return postJson("/skill-notation", opts);
}

export async function calcSkillMod(opts: {
  learnedByFocus: Record<string, Array<{ id: string }>>;
  skillId: string;
  ranks?: Record<string, number>;
  learningFocus?: string;
  skillMods?: Record<string, number>;
}): Promise<{ modifier: number }> {
  return postJson("/skill-mod", opts);
}

export async function calcStatusDeltas(opts: { statuses: string[] }): Promise<{ deltas: Record<string, number> }> {
  return postJson("/status-deltas", opts);
}

export async function calcStatusApply(opts: {
  derived: Record<string, any>;
  statuses: string[];
}): Promise<{ derived: Record<string, any>; deltas: Record<string, number> }> {
  return postJson("/status-apply", opts);
}

export async function calcAmmoMax(opts: { weapon: any }): Promise<{ ammoMax: number }> {
  return postJson("/ammo-max", opts);
}
