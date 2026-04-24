export interface FormFields {
  // Step 1
  uhrzeiten?: boolean;
  // Step 2
  personenAnzahl?: boolean;
  leiterinnen?: boolean;
  telefon?: boolean;
  sprache?: boolean;
  // Step 3
  bestuhlung?: boolean;
  tische?: boolean;
  beamer?: boolean;
  soundanlage?: boolean;
  aussenbereich?: boolean;
  sonstigesEquipment?: boolean;
  // Step 4
  verpflegung?: boolean;
  zimmerwunsch?: boolean;
  // Step 5
  wuenscheRahmenprogramm?: boolean;
  abrechnung?: boolean;
  anreise?: boolean;
  barrierefreiheit?: boolean;
  budget?: boolean;
  quelle?: boolean;
}

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
  };
  formTitle: string;
  formTitleFont?: string;
  formBgColor?: string;
  verpflegungOptions: string[];
  zimmerwunschOptions: string[];
  abrechnungOptions: string[];
  notifyEmail: string;
  formFields?: FormFields;
}

export interface BlockedDateEntry {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
  type: "blocked" | "event";
  color: string;
}

export interface InquiryFormData {
  artTitel: string;
  nameGruppenleitung: string;
  datumVon: string;
  datumBis: string;
  email: string;
  zeitVon: string;
  zeitBis: string;
  personenAnzahl: string;
  leiterinnen: string;
  bestuhlung: boolean | null;
  tische: boolean | null;
  beamer: boolean | null;
  soundanlage: boolean | null;
  aussenbereich: boolean | null;
  sonstigesEquipment: string;
  verpflegung: string;
  zimmerwunsch: string;
  wuenscheRahmenprogramm: string;
  abrechnung: string;
  telefon: string;
  sprache: string;
  anreise: string;
  barrierefreiheit: string;
  budget: string;
  quelle: string;
}
