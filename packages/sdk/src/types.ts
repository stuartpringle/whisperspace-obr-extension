export type Armor = {
  name?: string;
  keywords?: string[];
  keywordParams?: Record<string, string | number | boolean>;
  protection?: number;
  durability?: { current?: number; max?: number };
  bulk?: number;
  req?: string;
  cost?: number;
  special?: string;
};

export type Weapon = {
  id?: string;
  name?: string;
  skillId?: string;
  useDC?: number;
  damage?: number;
  keywords?: string[];
  keywordParams?: Record<string, string | number | boolean>;
  range?: string;
  ammo?: number;
  bulk?: number;
  req?: string;
  cost?: number;
};

export type Feat = {
  name?: string;
  description?: string;
  statusEffects?: string;
};

export type InventoryItem =
  | {
      id?: string;
      type: "item";
      name?: string;
      quantity?: number;
      uses?: string;
      bulk?: number;
      effect?: string;
      cost?: number;
      statusEffects?: string;
    }
  | {
      id?: string;
      type: "cyberware";
      name?: string;
      quantity?: number;
      bulk?: number;
      tier?: number;
      installationDifficulty?: number;
      requirements?: string;
      physicalImpact?: string;
      effect?: string;
      cost?: number;
      statusEffects?: string;
    }
  | {
      id?: string;
      type: "narcotics";
      name?: string;
      bulk?: number;
      quantity?: number;
      uses?: number;
      addictionScore?: number;
      legality?: string;
      effect?: string;
      cost?: number;
      statusEffects?: string;
    };

export type CharacterSheetV1 = {
  schemaVersion?: 1;
  name?: string;
  attributes?: { phys?: number; ref?: number; soc?: number; ment?: number };
  stress?: { current?: number; cuf?: number; cufLoss?: number };
  wounds?: { light?: number; moderate?: number; heavy?: number };
  skills?: Record<string, number>;
  learningFocus?: "combat" | "education" | "vehicles";
  skillPoints?: number;
  weapons?: Weapon[];
  armor?: Armor;
  credits?: number;
  inventory?: InventoryItem[];
  indomitable?: boolean;
  feats?: Feat[];
  notes?: string;
};
