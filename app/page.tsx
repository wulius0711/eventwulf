import { redirect } from "next/navigation";
import { loadConfigFromDB } from "@/lib/loadConfig";
import { buildThemeVars, DEFAULT_PRIMARY_COLOR } from "@/lib/theme";
import { isSafeCssColor } from "@/lib/validate";
import { hasFeature, effectivePlan } from "@/lib/plan";
import { prisma } from "@/lib/db";
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
  searchParams: Promise<{ kunde?: string; raeume?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const { kunde, raeume } = await searchParams;
  if (!kunde) redirect("/signup");
  const slug = kunde;
  const config = await loadConfigFromDB(slug);

  // Lets one client embed several widgets (e.g. one per landing page) that
  // each only offer a subset of rooms — same config/rooms, just a narrower
  // room list per embed, via an optional `raeume=id1,id2` query param on the
  // embed URL instead of a whole separate config/variant per page.
  const roomIds = raeume ? raeume.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  const client = await prisma.client.findUnique({
    where: { slug },
    select: {
      id: true,
      isDemo: true,
      organization: { select: { plan: true, subscriptionStatus: true, disputeLostAt: true } },
      rooms: {
        where: { isActive: true, ...(roomIds && { id: { in: roomIds } }) },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, description: true, image: true, capacity: true, isActive: true, sortOrder: true },
      },
    },
  });
  // Rooms are a Pro+ feature — a downgraded-to-Basis org keeps its existing
  // room rows (so re-upgrading restores them instantly), but guests should
  // no longer see or book them while on a plan that doesn't include Rooms.
  const orgPlan = effectivePlan(client?.organization);
  const roomsFeatureEnabled = hasFeature(orgPlan, "rooms");
  const initialRooms = roomsFeatureEnabled ? (client?.rooms ?? []) : [];
  const hasRooms = initialRooms.length > 0;
  const isDemo = client?.isDemo ?? false;

  const themeVars = buildThemeVars(config.company.primaryColor ?? DEFAULT_PRIMARY_COLOR);

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
  // Defense in depth alongside the validateConfig check on save — interpolated
  // raw into the <style> tag below, so an unsafe value here would be CSS injection.
  const pageBg = config.formBgColor && isSafeCssColor(config.formBgColor) ? config.formBgColor : "transparent";

  return (
    <div id="embed-root" style={themeVars as React.CSSProperties}>
      {/* Matches the widget's own background so a momentarily too-tall iframe never
          reveals an unstyled gap below the content. */}
      <style>{`body { background: ${pageBg}; }`}</style>
      <IframeResizer />
      {googleFontUrl && <link rel="stylesheet" href={googleFontUrl} />}
      <div className="ew-widget-wrap" style={{ padding: "2rem 1.5rem", background: pageBg, fontFamily: bodyFontFamily }}>
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
        <Wizard config={config} slug={slug} hasRooms={hasRooms} isDemo={isDemo} initialRooms={initialRooms} roomIds={roomIds} />
      </div>
    </div>
  );
}
