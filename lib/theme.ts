function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").padEnd(6, "0");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const m = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const d = (c: number) => Math.round(c * (1 - amount));
  return `rgb(${d(r)},${d(g)},${d(b)})`;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function buildThemeVars(primary: string, accent: string): Record<string, string> {
  const btnText = luminance(primary) > 0.35 ? "#111111" : "#ffffff";
  return {
    "--primary":       primary,
    "--primary-dark":  darken(primary, 0.2),
    "--primary-tint":  rgba(primary, 0.10),
    "--primary-dim":   rgba(primary, 0.18),
    "--accent":        accent,
    "--btn-text":      btnText,
    "--blocked-bg":    primary,
    "--blocked-text":  btnText,
  };
}
