import { z } from "zod";
import type { CharacterRecordV1 } from "@whisperspace/sdk";

/**
 * Whisperspace OBR Sheet - schema
 *
 * Backwards compatible exports:
 * - META_KEY_SHEET
 * - CharacterSheetSchemaV1 (alias)
 * - FeatSchema
 * - createDefaultSheet(name?)
 *
 * IMPORTANT: If you had an existing META_KEY_SHEET value, keep it the same.
 */
export const META_KEY_SHEET = "whisperspace.sheet.v1";

// -------------------------
// Shared small schemas
// -------------------------
export const FeatSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  // Comma-separated status effects, e.g. "carrying_capacity+5, cool_under_fire+1"
  statusEffects: z.string().default(""),
});
export type Feat = z.infer<typeof FeatSchema>;

export const ArmorSchema = z.object({
  name: z.string().default(""),
  keywords: z.array(z.string()).default([]),
  keywordParams: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  protection: z.number().int().nonnegative().default(0),
  durability: z
    .object({
      current: z.number().int().nonnegative().default(0),
      max: z.number().int().nonnegative().default(0),
    })
    .default({ current: 0, max: 0 }),

  // Optional fields used by prefab armor + UI
  bulk: z.number().int().nonnegative().optional(),
  req: z.string().optional(),
  cost: z.number().int().nonnegative().optional(),
  special: z.string().optional(),
});
export type Armor = z.infer<typeof ArmorSchema>;

export const WeaponSchema = z.object({
  id: z.string().optional(),
  name: z.string().default(""),
  skillId: z.string().default(""),
  useDC: z.number().int().default(8),
  damage: z.number().int().default(0),
  keywords: z.array(z.string()).default([]),
  keywordParams: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),

  // Optional fields used by prefab weapons + UI
  range: z.string().optional(),
  ammo: z.number().int().nonnegative().optional(),
  bulk: z.number().int().nonnegative().optional(),
  req: z.string().optional(),
  cost: z.number().int().nonnegative().optional(),
});
export type Weapon = z.infer<typeof WeaponSchema>;

// -------------------------
// Sheet schema
// -------------------------
export const CharacterSheetV1Schema = z.object({
  schemaVersion: z.literal(1).default(1),

  name: z.string().default(""),

  attributes: z
    .object({
      phys: z.number().int().nonnegative().default(0),
      ref: z.number().int().nonnegative().default(0),
      soc: z.number().int().nonnegative().default(0),
      ment: z.number().int().nonnegative().default(0),
    })
    .default({ phys: 0, ref: 0, soc: 0, ment: 0 }),

  stress: z
    .object({
      current: z.number().int().nonnegative().default(0),
      cuf: z.number().int().nonnegative().default(0),
      cufLoss: z.number().int().nonnegative().default(0),
    })
    .default({ current: 0, cuf: 0, cufLoss: 0 }),

  wounds: z
    .object({
      light: z.number().int().nonnegative().default(0),
      moderate: z.number().int().nonnegative().default(0),
      heavy: z.number().int().nonnegative().default(0),
    })
    .default({ light: 0, moderate: 0, heavy: 0 }),

  // Skill system
  skills: z.record(z.number().int()).default({}),
  learningFocus: z.enum(["combat", "education", "vehicles"]).optional(),
  skillPoints: z.number().int().nonnegative().optional(),

  // Combat loadout
  weapons: z.array(WeaponSchema).default([]),

  armor: ArmorSchema.optional(),

  // Inventory
  credits: z.number().int().nonnegative().default(0),
  inventory: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          id: z.string().optional(),
          type: z.literal("item"),
          name: z.string().default(""),
          quantity: z.number().int().default(1),
          uses: z.string().default(""),
          bulk: z.number().int().default(0),
          effect: z.string().default(""),
          cost: z.number().int().default(0),
          statusEffects: z.string().default(""),
        }),
        z.object({
          id: z.string().optional(),
          type: z.literal("cyberware"),
          name: z.string().default(""),
          quantity: z.number().int().default(1),
          bulk: z.number().int().default(1),
          tier: z.number().int().default(1),
          installationDifficulty: z.number().int().default(0),
          requirements: z.string().default(""),
          physicalImpact: z.string().default(""),
          effect: z.string().default(""),
          cost: z.number().int().default(0),
          statusEffects: z.string().default(""),
        }),
        z.object({
          id: z.string().optional(),
          type: z.literal("narcotics"),
          name: z.string().default(""),
          bulk: z.number().int().default(1),
          quantity: z.number().int().default(1),
          uses: z.number().int().default(1),
          addictionScore: z.number().int().default(0),
          legality: z.string().default(""),
          effect: z.string().default(""),
          cost: z.number().int().default(0),
          statusEffects: z.string().default(""),
        }),
      ])
    )
    .default([]),

  indomitable: z.boolean().default(false),

  feats: z.array(FeatSchema).default([]),

  notes: z.string().optional(),
});

export type CharacterSheetV1 = z.infer<typeof CharacterSheetV1Schema>;

/**
 * Backwards-compatible alias used by older code (migrate.ts).
 * Prefer CharacterSheetV1Schema going forward.
 */
export const CharacterSheetSchemaV1 = CharacterSheetV1Schema;

/**
 * Creates a fresh default sheet object.
 * Accepts an optional name because earlier code called createDefaultSheet("Name").
 */
export function createDefaultSheet(name?: string): CharacterSheetV1 {
  const base = CharacterSheetV1Schema.parse({});
  if (typeof name === "string" && name.trim().length > 0) {
    return { ...base, name: name.trim() };
  }
  return base;
}

// -------------------------
// Adapters (OBR token schema <-> canonical record)
// -------------------------
export type CharacterRecordAdapterOptions = {
  id?: string;
  concept?: string;
  background?: string;
  level?: number;
  createdAt?: string;
  updatedAt?: string;
};

function getUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `ws_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

/**
 * Lossy conversion: OBR token sheet -> canonical record.
 * This intentionally preserves only fields that exist in both models.
 */
export function toCharacterRecordV1(
  sheet: CharacterSheetV1,
  opts: CharacterRecordAdapterOptions = {}
): CharacterRecordV1 {
  const attrs = sheet.attributes ?? { phys: 0, ref: 0, soc: 0, ment: 0 };
  const createdAt = opts.createdAt ?? new Date().toISOString();
  const updatedAt = opts.updatedAt ?? createdAt;

  const skills = Object.entries(sheet.skills ?? {}).map(([key, rank]) => ({
    key,
    label: key,
    rank: Number(rank ?? 0),
  }));

  const gear: CharacterRecordV1["gear"] = [];
  const weapons = sheet.weapons ?? [];
  weapons.forEach((weapon, index) => {
    const id = weapon.id ?? `weapon_${index}`;
    gear.push({
      id,
      name: weapon.name ?? "",
      type: "weapon",
      tags: weapon.keywords ?? [],
      notes: weapon.range ?? "",
    });
  });

  if (sheet.armor) {
    gear.push({
      id: "armour_0",
      name: sheet.armor.name ?? "",
      type: "armour",
      tags: sheet.armor.keywords ?? [],
      notes: sheet.armor.special ?? "",
    });
  }

  (sheet.inventory ?? []).forEach((item, index) => {
    const id = item.id ?? `gear_${index}`;
    const base = { id, name: item.name ?? "", tags: [] as string[], notes: "" };
    if (item.type === "item") {
      gear.push({ ...base, type: "item", notes: item.effect ?? "" });
    } else if (item.type === "cyberware") {
      gear.push({ ...base, type: "cyberware", notes: item.effect ?? "" });
    } else if (item.type === "narcotics") {
      gear.push({ ...base, type: "narcotic", notes: item.effect ?? "" });
    }
  });

  return {
    id: opts.id ?? getUuid(),
    name: sheet.name ?? "",
    concept: opts.concept ?? "",
    background: opts.background ?? "",
    level: opts.level ?? 1,
    attributes: {
      phys: Number(attrs.phys ?? 0),
      ref: Number(attrs.ref ?? 0),
      soc: Number(attrs.soc ?? 0),
      ment: Number(attrs.ment ?? 0),
    },
    skills,
    gear,
    notes: sheet.notes ?? "",
    createdAt,
    updatedAt,
    version: 1,
  };
}

/**
 * Lossy conversion: canonical record -> OBR token sheet.
 */
export function fromCharacterRecordV1(record: CharacterRecordV1): CharacterSheetV1 {
  const base = createDefaultSheet(record.name);
  const skills: Record<string, number> = {};
  record.skills.forEach((skill) => {
    skills[skill.key] = Number(skill.rank ?? 0);
  });

  const weapons = record.gear
    .filter((g) => g.type === "weapon")
    .map((g) => ({
      id: g.id,
      name: g.name,
      skillId: "",
      useDC: 8,
      damage: 0,
      keywords: g.tags ?? [],
      keywordParams: {},
      range: g.notes ?? "",
    }));

  const armour = record.gear.find((g) => g.type === "armour");
  const inventory = record.gear
    .filter((g) => g.type !== "weapon" && g.type !== "armour")
    .map((g) => {
      if (g.type === "cyberware") {
        return {
          id: g.id,
          type: "cyberware" as const,
          name: g.name,
          quantity: 1,
          bulk: 1,
          tier: 1,
          installationDifficulty: 0,
          requirements: "",
          physicalImpact: "",
          effect: g.notes ?? "",
          cost: 0,
          statusEffects: "",
        };
      }
      if (g.type === "narcotic") {
        return {
          id: g.id,
          type: "narcotics" as const,
          name: g.name,
          bulk: 1,
          quantity: 1,
          uses: 1,
          addictionScore: 0,
          legality: "",
          effect: g.notes ?? "",
          cost: 0,
          statusEffects: "",
        };
      }
      return {
        id: g.id,
        type: "item" as const,
        name: g.name,
        quantity: 1,
        uses: "",
        bulk: 0,
        effect: g.notes ?? "",
        cost: 0,
        statusEffects: "",
      };
    });

  return {
    ...base,
    name: record.name,
    attributes: {
      phys: Number(record.attributes.phys ?? 0),
      ref: Number(record.attributes.ref ?? 0),
      soc: Number(record.attributes.soc ?? 0),
      ment: Number(record.attributes.ment ?? 0),
    },
    skills,
    weapons,
    armor: armour
      ? {
          name: armour.name ?? "",
          keywords: armour.tags ?? [],
          keywordParams: {},
          protection: 0,
          durability: { current: 0, max: 0 },
          special: armour.notes ?? "",
        }
      : base.armor,
    inventory,
    notes: record.notes ?? "",
  };
}
