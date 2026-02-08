import OBR from "@owlbear-rodeo/sdk";
import { setOpenTokenOverride } from "./obr/metadata";
import { META_KEY_SHEET } from "./rules/schema";
import { migrateSheet } from "./rules/migrate";
import { rollWithDicePlusTotal } from "./ui/diceplus/roll";
import { getInitiativeState, removeFromInitiative, upsertInitiativeEntry } from "./obr/initiative";
import { skillsData } from "./data/skills";
import { calcDeriveAttributes, calcDeriveCuf, calcSkillNotation, calcStatusDeltas } from "../packages/sdk/src/calc";

const EXT_ID = "com.whisperspace.sheet";
const MENU_ID = `${EXT_ID}/context/open-sheet`;
const POPOVER_ID = `${EXT_ID}/popover/open-sheet`;
const ROLL_INIT_MENU_ID = `${EXT_ID}/context/roll-initiative`;

/**
 * Background script:
 * - Registers a context menu entry.
 * - On click, sets a temporary openTokenId override and opens the sheet UI in a popover.
 */
async function main() {
  await OBR.onReady(async () => {
    await OBR.contextMenu.create({
      id: MENU_ID,
      icons: [
        {
          icon: "/icon.svg",
          label: "Open Whisperspace Sheet",
          filter: {
            min: 1,
            max: 1,
            every: [{ key: "layer", value: "CHARACTER" }],
          }
        }
      ],
      onClick: async (context, elementId) => {
        const item = context.items?.[0];
        const tokenId = (item as any)?.id as string | undefined;
        if (!tokenId) return;

        await setOpenTokenOverride(tokenId);

        await OBR.popover.open({
          id: POPOVER_ID,
          url: "/",
          height: 720,
          width: 520,
          // Anchor to the context-menu button that was clicked
          anchorElementId: elementId,
          anchorReference: "ELEMENT"
        });
      }
    });

	    await OBR.contextMenu.create({
	      id: ROLL_INIT_MENU_ID,
      icons: [
        {
          icon: "/icon.svg",
          label: "Roll Initiative",
          filter: {
            min: 1,
            max: 1,
            every: [{ key: "layer", value: "CHARACTER" }],
          }
        }
      ],
	      onClick: async (context) => {
	        const item = context.items?.[0] as any;
	        const tokenId = item?.id as string | undefined;
	        if (!tokenId) return;

	        // If the token is already in initiative, treat this as a remove.
	        const curInit = await getInitiativeState();
	        if ((curInit.entries ?? []).some((e) => e.tokenId === tokenId)) {
	          await removeFromInitiative(tokenId);
	          return;
	        }

	        const [token] = await OBR.scene.items.getItems([tokenId]);
	        const raw = (token?.metadata as any)?.[META_KEY_SHEET];
	        const sheet = migrateSheet(raw);
	        if (!sheet) return;

	        // Compute derived REF and effective CUF (including status effects) so context-menu rolls match UI.
	        const statusStrings: string[] = [];
	        (sheet.inventory ?? []).forEach((it: any) => {
	          if (typeof it?.statusEffects === "string" && it.statusEffects.trim()) statusStrings.push(it.statusEffects);
	        });
	        (sheet.feats ?? []).forEach((f: any) => {
	          if (typeof f?.statusEffects === "string" && f.statusEffects.trim()) statusStrings.push(f.statusEffects);
	        });
	        if (typeof (sheet as any)?.statusEffects === "string" && (sheet as any).statusEffects.trim()) {
	          statusStrings.push((sheet as any).statusEffects);
	        }
	        const status = await calcStatusDeltas({ statuses: statusStrings });

          const derivedAttrs = await calcDeriveAttributes({
            skills: sheet.skills ?? {},
            inherentSkills: skillsData.inherent ?? [],
          });
			    const attrDeltaRef = (status.deltas["ref"] ?? 0) + (status.deltas["reflex"] ?? 0);
	        const effectiveRef = Math.max(0, derivedAttrs.ref + attrDeltaRef);

	        const baseCuf = (await calcDeriveCuf({ skills: sheet.skills ?? {} })).cuf;
			    const effectiveCuf = Math.max(0, baseCuf + (status.deltas["cool_under_fire"] ?? 0));

	        const stressed = (sheet.stress?.current ?? 0) > effectiveCuf;
	        const notation = (await calcSkillNotation({
	          modifier: effectiveRef,
	          label: `${sheet.name} Initiative`,
	          netDice: stressed ? -1 : 0
	        })).notation;

	        const total = await rollWithDicePlusTotal({ diceNotation: notation, rollTarget: "everyone", showResults: true });
	        const thumbUrl = (token as any)?.image?.url as string | undefined;
	        await upsertInitiativeEntry({ tokenId, name: sheet.name, thumbUrl, initiative: total });
	      }
	    });
  });
}

main();
