import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { InquiryFormData } from "@/lib/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function StatCard({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <a
      href={href}
      style={{
        display: "block", flex: "1 1 200px", background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1.25rem 1.5rem", textDecoration: "none", color: "inherit",
      }}
    >
      <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.4rem" }}>{label}</div>
    </a>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const activeClient = await prisma.client.findUnique({ where: { slug: session.clientSlug }, select: { id: true } });

  if (!activeClient) {
    return (
      <div>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.3rem", fontWeight: 700 }}>Dashboard</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>Kein Kunde ausgewählt.</p>
      </div>
    );
  }

  const clientId = activeClient.id;
  const [openInquiryCount, upcomingEventCount, openInvoiceCount, recentInquiries] = await Promise.all([
    prisma.inquiry.count({ where: { clientId, status: "neu" } }),
    prisma.event.count({ where: { clientId, isActive: true, startDate: { gte: new Date() } } }),
    prisma.invoice.count({ where: { clientId, status: "offen" } }),
    prisma.inquiry.findMany({
      where: { clientId, status: "neu" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, data: true, createdAt: true },
    }),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.3rem", fontWeight: 700 }}>Dashboard</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>Überblick über offene Anfragen, Events und Dokumente.</p>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <StatCard href="/admin/inquiries" label="Offene Anfragen" value={openInquiryCount} />
        <StatCard href="/admin/vorschau" label="Anstehende Events" value={upcomingEventCount} />
        <StatCard href="/admin/invoices" label="Offene Angebote" value={openInvoiceCount} />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem 1.5rem" }}>
        <h2 style={{ margin: "0 0 0.9rem", fontSize: "0.95rem", fontWeight: 600 }}>Neueste Anfragen</h2>
        {recentInquiries.length === 0 ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>Keine offenen Anfragen.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {recentInquiries.map((inq) => {
              const d = JSON.parse(inq.data) as InquiryFormData;
              return (
                <a
                  key={inq.id}
                  href="/admin/inquiries"
                  style={{
                    display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.85rem",
                    padding: "0.5rem 0", borderBottom: "1px solid var(--border)", textDecoration: "none", color: "inherit",
                  }}
                >
                  <span>
                    <strong>{d.nameGruppenleitung || "Unbekannt"}</strong>
                    {d.artTitel ? ` — ${d.artTitel}` : ""}
                  </span>
                  <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(inq.createdAt.toISOString())}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
