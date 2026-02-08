import keywordsJson from "./generated/weapon_keywords.json";

export type WeaponKeyword = {
  name: string;
  description: string;
};

type KeywordsFile = { keywords: WeaponKeyword[] };

export const WEAPON_KEYWORDS = (keywordsJson as KeywordsFile).keywords ?? [];