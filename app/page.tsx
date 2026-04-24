import { loadConfigFromDB } from "@/lib/loadConfig";
import { buildThemeVars } from "@/lib/theme";
import Calendar from "@/components/Calendar";
import InquiryForm from "@/components/InquiryForm";

interface Props {
  searchParams: Promise<{ kunde?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const { kunde } = await searchParams;
  const slug = kunde ?? "default";
  const config = await loadConfigFromDB(slug);

  const themeVars = buildThemeVars(
    config.company.primaryColor,
    config.company.accentColor
  );

  return (
    <div style={themeVars as React.CSSProperties}>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          paddingBottom: "4rem",
        }}
      >
        {/* Company header */}
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "1rem 2rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            background: "var(--surface)",
          }}
        >
          {config.company.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.company.logo} alt={config.company.name} style={{ height: "2.5rem" }} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{config.company.name}</div>
            {config.company.tagline && (
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{config.company.tagline}</div>
            )}
          </div>
        </header>

        <main style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
          {/* Calendar section */}
          <div style={{ marginBottom: "3rem" }}>
            <Calendar slug={slug} />
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--border)", marginBottom: "3rem" }} />

          {/* Inquiry form */}
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              padding: "2.5rem 2rem",
              border: "1px solid var(--border)",
            }}
          >
            <InquiryForm config={config} slug={slug} />
          </div>
        </main>
      </div>
    </div>
  );
}
