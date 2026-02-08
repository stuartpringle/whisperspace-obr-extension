import tooltipsJson from "./generated/skill_tooltips.json";

type TooltipFile = {
  attributes?: Record<string, string>;
  skills?: Record<string, string>;
};

const data = tooltipsJson as TooltipFile;

export const ATTRIBUTE_TOOLTIPS: Record<string, string> = data.attributes ?? {};
export const SKILL_TOOLTIPS: Record<string, string> = data.skills ?? {};

const SKILL_BY_KEY = new Map(
  Object.entries(SKILL_TOOLTIPS).map(([k, v]) => [k.toLowerCase(), v])
);

export function getAttributeTooltip(shortForm: string) {
  return ATTRIBUTE_TOOLTIPS[shortForm] ?? "";
}

export function getSkillTooltip(label: string) {
  return SKILL_TOOLTIPS[label] ?? SKILL_BY_KEY.get(String(label ?? "").toLowerCase()) ?? "";
}
