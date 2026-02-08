export type AttributeId = "phys" | "ref" | "soc" | "ment";
export type FocusId = "combat" | "education" | "vehicles";

export type SkillDef = {
  id: string;
  label: string;
  attribute: AttributeId;
};

export type SkillsData = {
  version: number;
  inherent: SkillDef[];
  learned: Record<FocusId, SkillDef[]>;
};
