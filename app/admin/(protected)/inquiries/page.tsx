import InquiryInbox from "@/components/admin/InquiryInbox";
import PageTransition from "@/components/admin/PageTransition";

export default function InquiriesPage() {
  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.3rem", fontWeight: 700 }}>Anfragen</h1>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
            Alle eingegangenen Buchungsanfragen.
          </p>
        </div>
        <InquiryInbox />
      </div>
    </PageTransition>
  );
}
