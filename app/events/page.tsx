import { loadConfigFromDB } from "@/lib/loadConfig";
import { buildThemeVars } from "@/lib/theme";
import EventsList from "@/components/EventsList";
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

export default async function EventsPage({ searchParams }: Props) {
  const { kunde } = await searchParams;
  const slug = kunde ?? process.env.SUPERADMIN_SLUG ?? "default";
  const config = await loadConfigFromDB(slug);

  const themeVars = buildThemeVars(config.company.primaryColor);
  const bodyFont = config.formBodyFont ?? "";
  const googleFontUrl = bodyFont && GOOGLE_FONTS[bodyFont]
    ? `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS[bodyFont]}&display=swap`
    : null;
  const bodyFontFamily = bodyFont ? `'${bodyFont}', system-ui, sans-serif` : undefined;

  return (
    <div id="embed-root" style={themeVars as React.CSSProperties}>
      <IframeResizer />
      {googleFontUrl && <link rel="stylesheet" href={googleFontUrl} />}
      <div className="ew-widget-wrap" style={{ padding: "1.5rem", background: config.formBgColor || "transparent", fontFamily: bodyFontFamily }}>
        <EventsList slug={slug} />
      </div>
    </div>
  );
}
