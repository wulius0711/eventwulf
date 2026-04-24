"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "0.35rem 0.9rem",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: "none",
        color: "var(--muted)",
        cursor: "pointer",
        fontSize: "0.82rem",
      }}
    >
      Abmelden
    </button>
  );
}
