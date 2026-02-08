import { z } from "zod";

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