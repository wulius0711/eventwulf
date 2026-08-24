import { loadConfigFromDB } from "@/lib/loadConfig";
import { buildThemeVars } from "@/lib/theme";
import Wizard from "@/components/Wizard";
import IframeResizer from "@/components/IframeResizer";

const GOOGLE_FONTS: Record<string, string> = {
  "Cormorant Garamond": "Cormorant+Garamond:wght@300;400;500",
  "Playfair Display":   "Playfair+Display:wght@400;600",
  "Lora":               "Lora:wght@400;500",
  "DM Serif Display":   "DM+Serif+Display:ital@0",
  "EB Garamond":        "EB+Garamond:wght@400;500",
  "Inter":              "Inter:wght@400;500;600",
  "Lato":               "Lato:wght@400;700",
  "Source Sans 3":      "Source+Sans+3:wght@400;600",
  "Nunito":             "Nunito:wght@400;600",
};

interface Props {
  searchParams: Promise<{ kunde?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const { kunde } = await searchParams;
  const slug = kunde ?? process.env.SUPERADMIN_SLUG ?? "default";
  const config = await loadConfigFromDB(slug);

  const themeVars = buildThemeVars(config.company.primaryColor);

  const titleFont = config.formTitleFont ?? "Cormorant Garamond";
  const bodyFont  = config.formBodyFont ?? "";

  const fontParams = [titleFont, bodyFont]
    .filter((f) => f && GOOGLE_FONTS[f])
    .map((f) => GOOGLE_FONTS[f])
    .join("&family=");
  const googleFontUrl = fontParams
    ? `https://fonts.googleapis.com/css2?family=${fontParams}&display=swap`
    : null;

  const bodyFontFamily = bodyFont ? `'${bodyFont}', system-ui, sans-serif` : undefined;
  const pageBg = config.formBgColor || "transparent";

  return (
    <div id="embed-root" style={themeVars as React.CSSProperties}>
      {/* Matches the widget's own background so a momentarily too-tall iframe never
          reveals an unstyled gap below the content. */}
      <style>{`body { background: ${pageBg}; }`}</style>
      <IframeResizer />
      {googleFontUrl && <link rel="stylesheet" href={googleFontUrl} />}
      <div className="ew-widget-wrap" style={{ padding: "2rem 1.5rem", background: config.formBgColor || "transparent", fontFamily: bodyFontFamily }}>
        {config.formTitle && (
          <h2
            className="ew-widget-title"
            style={{
              textAlign: "center",
              fontFamily: `'${titleFont}', Georgia, serif`,
              fontSize: "2rem",
              fontWeight: 300,
              letterSpacing: "0.02em",
              lineHeight: 1.3,
              color: "var(--text)",
              marginTop: "0.5rem",
              marginBottom: "3rem",
            }}
          >
            {config.formTitle}
          </h2>
        )}
        <Wizard config={config} slug={slug} />
      </div>
    </div>
  );
}
