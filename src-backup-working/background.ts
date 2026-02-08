import OBR from "@owlbear-rodeo/sdk";
import { setOpenTokenOverride } from "./obr/metadata";

const EXT_ID = "com.whisperspace.sheet";
const MENU_ID = `${EXT_ID}/context/open-sheet`;
const POPOVER_ID = `${EXT_ID}/popover/open-sheet`;

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
          filter: { min: 1, max: 1 }
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
  });
}

main();
