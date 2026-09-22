import InvoiceArchive from "@/components/admin/InvoiceArchive";

export default function InvoicesPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.3rem", fontWeight: 700 }}>Angebote</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
          Alle erstellten Angebote.
        </p>
      </div>
      <InvoiceArchive />
    </div>
  );
}
