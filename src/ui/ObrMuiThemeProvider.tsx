import React, { useEffect, useMemo, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";

type ObrTheme = any; // OBR theme typing varies by sdk; we map defensively

function toMuiTheme(t: ObrTheme) {
  const mode = (t?.mode ?? "LIGHT") === "DARK" ? "dark" : "light";

  // Defensive reads (Owlbear provides these fields via OBR.theme.getTheme())
  const bgDefault = t?.background?.default ?? (mode === "dark" ? "#121212" : "#ffffff");
  const bgPaper = t?.background?.paper ?? (mode === "dark" ? "#1e1e1e" : "#f7f7f7");

  const textPrimary = t?.text?.primary ?? (mode === "dark" ? "#ffffff" : "#111111");
  const textSecondary = t?.text?.secondary ?? (mode === "dark" ? "#bdbdbd" : "#444444");

  const primaryMain = t?.primary?.main ?? "#2f6fed";
  const primaryContrast = t?.primary?.contrastText ?? "#ffffff";

  const secondaryMain = t?.secondary?.main ?? "#7c3aed";
  const secondaryContrast = t?.secondary?.contrastText ?? "#ffffff";

  return createTheme({
    palette: {
      mode,
      background: { default: bgDefault, paper: bgPaper },
      text: { primary: textPrimary, secondary: textSecondary },
      primary: { main: primaryMain, contrastText: primaryContrast },
      secondary: { main: secondaryMain, contrastText: secondaryContrast }
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    },
    components: {
      MuiPaper: { defaultProps: { elevation: 0 } },
      MuiButton: {
        styleOverrides: {
          root: {
            color: textPrimary,
            ...(mode === "dark"
              ? {
                  borderColor: "rgba(255,255,255,0.25)",
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(255,255,255,0.45)",
                  },
                }
              : {}),
          },
          containedPrimary: {
            color: primaryContrast,
          },
          containedSecondary: {
            color: secondaryContrast,
          },
        },
      },
      MuiButtonBase: {
        styleOverrides: {
          root: mode === "dark"
            ? {
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.06)",
                },
              }
            : {},
        },
      },
    }
  });
}

export function ObrMuiThemeProvider(props: { children: React.ReactNode }) {
  const [obrTheme, setObrTheme] = useState<ObrTheme | null>(null);

  useEffect(() => {
    let unsub: null | (() => void) = null;
    let cancelled = false;

    OBR.onReady(async () => {
      if (cancelled) return;
      try {
        const initial = await OBR.theme.getTheme();
        if (!cancelled) setObrTheme(initial);
        unsub = OBR.theme.onChange((next) => setObrTheme(next));
      } catch {
        // ignore
      }
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  const muiTheme = useMemo(() => toMuiTheme(obrTheme), [obrTheme]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {props.children}
    </ThemeProvider>
  );
}
