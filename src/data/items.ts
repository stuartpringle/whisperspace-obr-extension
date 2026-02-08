import itemsJson from "./generated/items.json";

export type ItemTemplate = {
  name: string;
  effect: string;
  uses: string;
  bulk?: number;
  cost?: number;
  statusEffects?: string;
};

export const ITEM_TEMPLATES = (itemsJson as any).items as ItemTemplate[];
