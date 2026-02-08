import { z } from "zod";
export const FeatSchema = z.object({
    name: z.string().default(""),
    description: z.string().default(""),
    statusEffects: z.string().default(""),
});
export const ArmourSchema = z.object({
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
    bulk: z.number().int().nonnegative().optional(),
    req: z.string().optional(),
    cost: z.number().int().nonnegative().optional(),
    special: z.string().optional(),
});
export const WeaponSchema = z.object({
    id: z.string().optional(),
    name: z.string().default(""),
    skillId: z.string().default(""),
    useDC: z.number().int().default(8),
    damage: z.number().int().default(0),
    keywords: z.array(z.string()).default([]),
    keywordParams: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
    range: z.string().optional(),
    ammo: z.number().int().nonnegative().optional(),
    bulk: z.number().int().nonnegative().optional(),
    req: z.string().optional(),
    cost: z.number().int().nonnegative().optional(),
});
