import narcoticsJson from "./generated/narcotics.json";

export type NarcoticsTemplate = {
  name: string;
  effect: string;
  uses: number;
  addictionScore: number;
  legality: string;
  bulk?: number;
  cost?: number;
  statusEffects?: string;
};

export const NARCOTICS_TEMPLATES = (narcoticsJson as any).narcotics as NarcoticsTemplate[];
