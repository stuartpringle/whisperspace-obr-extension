import { skillsData } from "../data/skills";
import type { SkillDef } from "../data/types";

/**
 * Attributes are derived from the sum of skill ranks beneath them.
 * Current rule: Attribute = ceil((sum of ranks) / 4)
 *
 * IMPORTANT DESIGN CHOICE:
 * - We only count inherent skills (PHYS/REF/SOC/MENT) here, because learned skills
 *   are grouped by Learning Focus (Combat/Education/Vehicles) in the rules text.
 */
export function deriveAttributesFromSkills(skills: Record<string, number>): {
  phys: number;
  ref: number;
  soc: number;
  ment: number;
} {
  const inherent: SkillDef[] = skillsData.inherent ?? [];

  const sums = { phys: 0, ref: 0, soc: 0, ment: 0 };

  for (const s of inherent) {
    const rank = Number(skills?.[s.id] ?? 0);
    const attr = s.attribute; // "phys" | "ref" | "soc" | "ment"
    if (attr && (attr in sums)) {
      (sums as any)[attr] += Math.max(0, rank);
    }
  }

  return {
    phys: Math.max(0, Math.ceil(sums.phys / 4)),
    ref: Math.max(0, Math.ceil(sums.ref / 4)),
    soc: Math.max(0, Math.ceil(sums.soc / 4)),
    ment: Math.max(0, Math.ceil(sums.ment / 4)),
  };
}