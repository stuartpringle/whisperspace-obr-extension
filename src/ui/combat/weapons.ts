import type { CharacterSheetV1 } from "../../rules/schema";
import { getAmmoMax as coreGetAmmoMax } from "../../../packages/core/src/weapons";

export function getAmmoMax(w: CharacterSheetV1["weapons"][number] | undefined): number {
  return coreGetAmmoMax(w);
}
