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
  zahlung?: boolean;
  anreise?: boolean;
  barrierefreiheit?: boolean;
  budget?: boolean;
  quelle?: boolean;
}

export interface EventConfig {
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
  formBodyFont?: string;
  formBgColor?: string;
  verpflegungOptions: string[];
  zimmerwunschOptions: string[];
  abrechnungOptions: string[];
  ausstattungOptions: string[];
  anreiseOptions: string[];
  zahlungOptions: string[];
  budgetOptions: string[];
  quelleOptions: string[];
  notifyEmail: string;
  formFields?: FormFields;
  showPackages?: boolean;
  showCapacity?: boolean;
  billing?: {
    taxRate?: number;
    validityDays?: number;
  };
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceEntry {
  id: string;
  inquiryId: string;
  number: string;
  status: string;
  lineItems: InvoiceLineItem[];
  taxRate: number;
  validUntil: string | null;
  notes: string;
  sentAt: string | null;
  issuedAt: string;
}

export interface BlockedDateEntry {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
  type: "blocked" | "event";
  color: string;
  maxCapacity?: number | null;
  bookedCount?: number;
}

export interface PackageEntry {
  id: string;
  name: string;
  description: string;
  pricePerPerson: number;
  minParticipants: number;
  maxParticipants: number;
  durationDays: number;
  isActive: boolean;
  sortOrder: number;
}

export interface InquiryFormData {
  packageId?: string;
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
  ausstattungExtra: string[];
  zahlung: string;
  anreise: string;
  barrierefreiheit: string;
  budget: string;
  quelle: string;
}
