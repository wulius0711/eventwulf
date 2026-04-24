export interface YogaConfig {
  company: {
    name: string;
    tagline: string;
    logo: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    primaryColor: string;
    accentColor: string;
  };
  formTitle: string;
  verpflegungOptions: string[];
  zimmerwunschOptions: string[];
  abrechnungOptions: string[];
  notifyEmail: string;
}

export interface BlockedDateEntry {
  id: string;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  label: string;
}

export interface InquiryFormData {
  artTitel: string;
  nameGruppenleitung: string;
  gruppengroesse: string;
  datum: string;
  email: string;
  veranstaltungBeginnEnde: string;
  personenAnzahl: string;
  leiterinnen: string;
  bestuhlung: boolean | null;
  tische: boolean | null;
  sonstigesEquipment: string;
  verpflegung: string;
  zimmerwunsch: string;
  wuenscheRahmenprogramm: string;
  abrechnung: string;
}
