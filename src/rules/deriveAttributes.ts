import { skillsData } from "../data/skills";
import type { SkillDef } from "../data/types";
import { deriveAttributesFromSkills as deriveCoreAttributes, deriveCUFFromSkills as deriveCoreCUF } from "../../packages/core/src/deriveAttributes";

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
  return deriveCoreAttributes(skills, inherent);
}

export function deriveCUFFromSkills(skills: Record<string, number>): number {
  return deriveCoreCUF(skills);
}
