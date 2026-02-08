import cyberJson from "./generated/cyberware.json";

export type CyberwareTemplate = {
  name: string;
  tier: number;
  effect: string;
  installationDifficulty: number;
  requirements?: string;
  physicalImpact?: string;
  bulk?: number;
  cost?: number;
  statusEffects?: string;
};

export const CYBERWARE_TEMPLATES = (cyberJson as any).cyberware as CyberwareTemplate[];
