import type { EventConfig, PublicWidgetConfig } from "@/lib/types";

// Builds the config object the public widget (components/Wizard.tsx) gets as a
// prop. Every field is listed explicitly — allowlist, not blocklist — so a
// field added to EventConfig later stays server-side until someone decides the
// widget needs it. Audit 2026-09-26, M2 (the widget HTML used to contain
// notifyEmail, company contact data and billing settings).
export function toPublicWidgetConfig(config: EventConfig): PublicWidgetConfig {
  return {
    formFields: config.formFields,
    verpflegungOptions: config.verpflegungOptions,
    zimmerwunschOptions: config.zimmerwunschOptions,
    abrechnungOptions: config.abrechnungOptions,
    ausstattungOptions: config.ausstattungOptions,
    anreiseOptions: config.anreiseOptions,
    zahlungOptions: config.zahlungOptions,
    budgetOptions: config.budgetOptions,
    quelleOptions: config.quelleOptions,
    customFields: config.customFields,
  };
}
