import { WEAPON_KEYWORDS } from "../data/weaponKeywords";

export type WeaponKeywordMatch = {
  label: string;
  description: string;
  anchor: string;
};

type KeywordMatcher = {
  name: string;
  description: string;
  regex: RegExp;
  hasParam: boolean;
};

const KEYWORD_ANCHOR = "weapon-keywords";

function slugify(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMatcher(defName: string): { regex: RegExp; hasParam: boolean } {
  const trimmed = defName.trim();
  if (trimmed.includes("(X)")) {
    const pattern = "^" + escapeRegExp(trimmed).replace("\\(X\\)", "\\((.+)\\)") + "$";
    return { regex: new RegExp(pattern, "i"), hasParam: true };
  }
  if (trimmed.includes(" X")) {
    const pattern = "^" + escapeRegExp(trimmed).replace(" X", "\\s+(.+)") + "$";
    return { regex: new RegExp(pattern, "i"), hasParam: true };
  }
  return { regex: new RegExp("^" + escapeRegExp(trimmed) + "$", "i"), hasParam: false };
}

const KEYWORD_MATCHERS: KeywordMatcher[] = WEAPON_KEYWORDS.map((k) => {
  const { regex, hasParam } = buildMatcher(k.name);
  return {
    name: k.name,
    description: k.description,
    regex,
    hasParam,
  };
});

function normalizeParam(param: string) {
  return String(param ?? "").trim();
}

export function resolveWeaponKeyword(keyword: string): WeaponKeywordMatch | null {
  const text = String(keyword ?? "").trim();
  if (!text) return null;
  const slug = slugify(text);
  for (const def of KEYWORD_MATCHERS) {
    const match = text.match(def.regex);
    if (!match) continue;
    const param = def.hasParam ? normalizeParam(match[1]) : "";
    const description = def.hasParam
      ? def.description.replace(/\bX\b/g, param || "X")
      : def.description;
    return {
      label: text,
      description,
      anchor: slug ? `weapon-keyword-${slug}` : KEYWORD_ANCHOR,
    };
  }
  return null;
}

export function splitKeywordList(text: string): string[] {
  return String(text ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
