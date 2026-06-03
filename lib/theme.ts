function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").padEnd(6, "0");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
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

function ensureTextContrast(hex: string): string {
  let current = hex;
  let amount = 0;
  while (amount <= 0.9) {
    const lum = luminance(current);
    if ((1.05) / (lum + 0.05) >= 4.5) return current;
    amount += 0.1;
    current = darken(hex, amount);
  }
  return "#111111";
}

export function buildThemeVars(primary: string): Record<string, string> {
  const btnText = luminance(primary) > 0.35 ? "#111111" : "#ffffff";
  return {
    "--primary":      primary,
    "--primary-dark": darken(primary, 0.2),
    "--primary-tint": rgba(primary, 0.10),
    "--primary-dim":  rgba(primary, 0.18),
    "--primary-text": ensureTextContrast(primary),
    "--btn-text":     btnText,
    "--blocked-bg":   primary,
    "--blocked-text": btnText,
  };
}
