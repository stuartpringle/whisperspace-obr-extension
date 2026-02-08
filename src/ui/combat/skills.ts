import { skillsData } from "../../data/skills";
import type { FocusId } from "../../data/types";
import type { CharacterSheetV1 } from "../../rules/schema";
import { buildLearnedInfoById, skillModifierFor as coreSkillModifierFor } from "../../../packages/core/src/skills";

export function makeLearnedInfoById() {
  return buildLearnedInfoById<FocusId>(skillsData.learned);
}

export function skillModifierFor(opts: {
  learnedInfoById: Map<string, { focus: FocusId }>;
  sheet: CharacterSheetV1;
  skillId: string;
  skillMods?: Record<string, number>;
}): number {
  return coreSkillModifierFor({
    learnedInfoById: opts.learnedInfoById as Map<string, { focus: FocusId }>,
    skillId: opts.skillId,
    ranks: opts.sheet.skills,
    learningFocus: opts.sheet.learningFocus,
    skillMods: opts.skillMods,
  });
}
