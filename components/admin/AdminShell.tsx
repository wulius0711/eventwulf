"use client";
import { useState } from "react";
import { PLAN_LABELS, type Plan } from "@/lib/plan";
import AdminNav from "./AdminNav";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";
import { ToastProvider } from "./Toast";
import { MenuIcon, CloseIcon, BrandMark } from "./icons";

interface Props {
  bookingAppUrl: string | null;
  isSuperAdmin: boolean;
  slugs: string[];
  activeSlug: string;
  newInquiryCount: number;
  openInvoiceCount: number;
  plan: Plan | null;
  children: React.ReactNode;
}

export default function AdminShell({ bookingAppUrl, isSuperAdmin, slugs, activeSlug, newInquiryCount, openInvoiceCount, plan, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <ToastProvider>
      {/* Mobile topbar with hamburger */}
      <div className="ew-topbar">
        <button className="ew-hamburger" onClick={() => setOpen(!open)} aria-label="Menü">
          {open ? CloseIcon : MenuIcon}
        </button>
        {BrandMark}
        <span className="ew-topbar-brand">eventwulf</span>
      </div>

      {/* Backdrop for mobile drawer */}
      {open && <div className="ew-nav-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`ew-sidebar${open ? " ew-sidebar--open" : ""}`}>
        <div className="ew-sidebar-brand">
          {BrandMark}
          <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--primary)", letterSpacing: "-0.03em" }}>eventwulf</span>
        </div>

        <nav className="ew-sidebar-nav">
          <AdminNav isSuperAdmin={isSuperAdmin} slugs={slugs} activeSlug={activeSlug} newInquiryCount={newInquiryCount} openInvoiceCount={openInvoiceCount} onNavigate={() => setOpen(false)} />
        </nav>

        <div className="ew-sidebar-footer">
          {plan && (
            <a
              href="/admin/config?tab=abrechnung"
              style={{ fontSize: "0.78rem", color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}
            >
              Plan: {PLAN_LABELS[plan]}
            </a>
          )}
          {bookingAppUrl && (
            <a href={bookingAppUrl} style={{ fontSize: "0.82rem", color: "var(--muted)", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span>←</span> bookingwulf
            </a>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </aside>

      <main className="ew-shell-main">
        {children}
      </main>
    </ToastProvider>
  );
}
