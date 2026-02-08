import weaponsJson from "./generated/weapons.json";

export type WeaponTemplate = {
  id: string;
  name: string;
  skillId: string;
  useDC: number;
  damage: number;
  range?: string;
  ammo?: number;
  bulk?: number;
  req?: string;
  cost?: number;
  keywords?: string[];
  keywordParams?: Record<string, string | number | boolean>;
};

type WeaponsFile = { weapons: WeaponTemplate[] };

export const WEAPON_TEMPLATES = (weaponsJson as WeaponsFile).weapons ?? [];