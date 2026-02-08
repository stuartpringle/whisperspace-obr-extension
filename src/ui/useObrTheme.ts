import { useEffect } from "react";
import OBR from "@owlbear-rodeo/sdk";

export function useObrThemeCssVars() {
  useEffect(() => {
    let unsub: null | (() => void) = null;
    let cancelled = false;

    const apply = (theme: any) => {
      const root = document.documentElement;

      // Mode: "LIGHT" | "DARK"
      root.dataset.obrMode = theme.mode;

      // Core palette (from OBR Theme object)
      root.style.setProperty("--obr-bg", theme.background.default);
      root.style.setProperty("--obr-surface", theme.background.paper);

      root.style.setProperty("--obr-text", theme.text.primary);
      root.style.setProperty("--obr-text-muted", theme.text.secondary);
      root.style.setProperty("--obr-text-disabled", theme.text.disabled);

      root.style.setProperty("--obr-primary", theme.primary.main);
      root.style.setProperty("--obr-primary-contrast", theme.primary.contrastText);

      root.style.setProperty("--obr-secondary", theme.secondary.main);
      root.style.setProperty("--obr-secondary-contrast", theme.secondary.contrastText);
    };

    OBR.onReady(async () => {
      if (cancelled) return;
      try {
        const theme = await OBR.theme.getTheme();
        if (!cancelled) apply(theme);
        unsub = OBR.theme.onChange(apply);
      } catch {
        // ignore
      }
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);
}
