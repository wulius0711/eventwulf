"use client";
import { useState } from "react";
import { PLAN_LABELS, type Plan } from "@/lib/plan";
import AdminNav from "./AdminNav";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";

interface Props {
  bookingAppUrl: string | null;
  isSuperAdmin: boolean;
  slugs: string[];
  activeSlug: string;
  newInquiryCount: number;
  plan: Plan | null;
  children: React.ReactNode;
}

export default function AdminShell({ bookingAppUrl, isSuperAdmin, slugs, activeSlug, newInquiryCount, plan, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile topbar with hamburger */}
      <div className="ew-topbar">
        <button className="ew-hamburger" onClick={() => setOpen(!open)} aria-label="Menü">
          {open ? "✕" : "☰"}
        </button>
        <span className="ew-topbar-brand">eventwulf</span>
      </div>

      {/* Backdrop for mobile drawer */}
      {open && <div className="ew-nav-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`ew-sidebar${open ? " ew-sidebar--open" : ""}`}>
        <div className="ew-sidebar-brand">
          <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--primary)", letterSpacing: "-0.03em" }}>eventwulf</span>
        </div>

        <nav className="ew-sidebar-nav">
          <AdminNav isSuperAdmin={isSuperAdmin} slugs={slugs} activeSlug={activeSlug} newInquiryCount={newInquiryCount} onNavigate={() => setOpen(false)} />
        </nav>

        <div className="ew-sidebar-footer">
          {plan && (
            <a
              href="/admin/config"
              style={{ fontSize: "0.78rem", color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}
            >
              Plan: {PLAN_LABELS[plan]}
            </a>
          )}
          <div style={{ display: "flex", alignItems: "center" }}>
            {bookingAppUrl && (
              <a href={bookingAppUrl} style={{ fontSize: "0.82rem", color: "var(--muted)", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.3rem", flex: 1 }}>
                <span>←</span> bookingwulf
              </a>
            )}
            <ThemeToggle />
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="ew-shell-main">
        {children}
      </main>
    </>
  );
}
