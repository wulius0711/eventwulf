import { redirect } from "next/navigation";
import { loadConfigFromDB } from "@/lib/loadConfig";
import { buildThemeVars, DEFAULT_PRIMARY_COLOR } from "@/lib/theme";
import { isSafeCssColor } from "@/lib/validate";
import { hasFeature, effectivePlan } from "@/lib/plan";
import { prisma } from "@/lib/db";
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

const ALIGN_VALUES = ["left", "center", "right"] as const;
type Align = (typeof ALIGN_VALUES)[number];

interface Props {
  searchParams: Promise<{ kunde?: string; ausrichtung?: string }>;
}

export default async function EventsPage({ searchParams }: Props) {
  const { kunde, ausrichtung } = await searchParams;
  if (!kunde) redirect("/signup");
  const slug = kunde;
  const align: Align = (ALIGN_VALUES as readonly string[]).includes(ausrichtung ?? "") ? (ausrichtung as Align) : "left";
  const config = await loadConfigFromDB(slug);
  const client = await prisma.client.findUnique({
    where: { slug },
    select: { isDemo: true, organization: { select: { plan: true, subscriptionStatus: true, disputeLostAt: true } } },
  });
  const isDemo = client?.isDemo ?? false;
  const showBranding = !hasFeature(effectivePlan(client?.organization), "removeBranding");

  const themeVars = buildThemeVars(config.company.primaryColor ?? DEFAULT_PRIMARY_COLOR);
  const bodyFont = config.formBodyFont ?? "";
  const googleFontUrl = bodyFont && GOOGLE_FONTS[bodyFont]
    ? `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS[bodyFont]}&display=swap`
    : null;
  const bodyFontFamily = bodyFont ? `'${bodyFont}', system-ui, sans-serif` : undefined;

  // Defense in depth alongside the validateConfig check on save — interpolated
  // raw into the <style> tag below, so an unsafe value here would be CSS injection.
  const pageBg = config.formBgColor && isSafeCssColor(config.formBgColor) ? config.formBgColor : "transparent";

  return (
    <div id="embed-root" style={themeVars as React.CSSProperties}>
      {/* Matches the widget's own background so a momentarily too-tall iframe (e.g.
          right after the resize-height catches up post-submit) never reveals an
          unstyled gap below the content. */}
      <style>{`body { background: ${pageBg}; }`}</style>
      <IframeResizer />
      {googleFontUrl && <link rel="stylesheet" href={googleFontUrl} />}
      <div className="ew-widget-wrap" style={{ padding: "1.5rem", background: pageBg, fontFamily: bodyFontFamily }}>
        <EventsList slug={slug} isDemo={isDemo} showBranding={showBranding} align={align} />
      </div>
    </div>
  );
}
