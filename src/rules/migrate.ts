import { CharacterSheetSchemaV1, createDefaultSheet, CharacterSheetV1 } from "./schema";

export function migrateToLatest(raw: unknown): CharacterSheetV1 {
  const v1 = CharacterSheetSchemaV1.safeParse(raw);
  if (v1.success) return v1.data;

  const base = createDefaultSheet(typeof (raw as any)?.name === "string" ? (raw as any).name : undefined);

  const maybeSkills = (raw as any)?.skills;
  const skills = migrateSkills(isRecordNumber(maybeSkills) ? maybeSkills : {});

  const merged: any = {
    ...base,
    ...pick(raw, ["name", "archetype", "background", "motivation", "notes"]),
    attributes: { ...base.attributes, ...pick((raw as any)?.attributes, ["phys", "ref", "soc", "ment"]) },
    stress: { ...base.stress, ...pick((raw as any)?.stress, ["current", "cuf"]) },
    wounds: { ...base.wounds, ...pick((raw as any)?.wounds, ["light", "moderate", "heavy"]) },
    skills,
    feats: Array.isArray((raw as any)?.feats) ? (raw as any).feats : base.feats,
    weapons: Array.isArray((raw as any)?.weapons) ? (raw as any).weapons : base.weapons,
    armor: (raw as any)?.armor ?? base.armor,
    schemaVersion: 1
  };

  const parsed = CharacterSheetSchemaV1.safeParse(merged);
  return parsed.success ? parsed.data : base;
}

// Backwards-compatible export (older code imports `migrateSheet`).
export const migrateSheet = migrateToLatest;

const SKILL_RENAMES: Record<string, string> = {
  powerlifting: "powerlift",
  light_weapons: "weapons_light",
  medium_weapons: "weapons_medium",
  heavy_weapons: "weapons_heavy",
  exotic_weapons: "weapons_exotic",
  melee_blunt: "melee_weapons",
  melee_sharp: "melee_weapons"
};

function migrateSkills(skills: Record<string, number>) {
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(skills ?? {})) {
    const nk = SKILL_RENAMES[k] ?? k;
    const vv = typeof v === "number" ? v : 0;
    next[nk] = Math.max(next[nk] ?? 0, vv);
  }
  for (const [k, v] of Object.entries(next)) {
    if (!v) delete next[k];
  }
  return next;
}

function pick(obj: any, keys: string[]) {
  const out: any = {};
  if (!obj || typeof obj !== "object") return out;
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function isRecordNumber(x: unknown): x is Record<string, number> {
  if (!x || typeof x !== "object") return false;
  for (const v of Object.values(x as any)) if (typeof v !== "number") return false;
  return true;
}
