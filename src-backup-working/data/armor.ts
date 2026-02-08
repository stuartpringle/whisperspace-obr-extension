import armorJson from "./generated/armor.json";

export type ArmorTemplate = {
  id: string;
  name: string;
  protection: number;
  durability: number;
  bulk?: number;
  req?: string;
  special?: string;
  cost?: number;
  keywords?: string[];
  keywordParams?: Record<string, string | number | boolean>;
};

type ArmorFile = { armor: ArmorTemplate[] };

export const ARMOR_TEMPLATES = (armorJson as ArmorFile).armor ?? [];