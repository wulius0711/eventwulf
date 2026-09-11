// Most fields are just shown/hidden (boolean). A field can also be marked
// "required" — shown *and* mandatory. personenAnzahl and raum are
// deliberately plain booleans: their required-ness is a structural system
// invariant (capacity math, double-booking protection), not a per-client
// preference, so they're not part of the configurable-required system.
type FieldState = boolean | "required";

export interface FormFields {
  // Step 1
  uhrzeiten?: FieldState;
  raum?: boolean;
  // Step 2
  personenAnzahl?: boolean;
  leiterinnen?: FieldState;
  telefon?: FieldState;
  sprache?: FieldState;
  // Step 3
  bestuhlung?: boolean;
  tische?: boolean;
  beamer?: boolean;
  soundanlage?: boolean;
  aussenbereich?: boolean;
  sonstigesEquipment?: FieldState;
  // Step 4
  verpflegung?: FieldState;
  zimmerwunsch?: FieldState;
  // Step 5
  wuenscheRahmenprogramm?: FieldState;
  abrechnung?: FieldState;
  zahlung?: FieldState;
  anreise?: FieldState;
  barrierefreiheit?: FieldState;
  budget?: FieldState;
  quelle?: FieldState;
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
  intern?: boolean;
  roomName?: string | null;
  silent?: boolean; // blocks the days but skips the "nicht verfügbar" banner
}

export interface EventEntry {
  id: string;
  name: string;
  description: string;
  image: string;
  startDate: string;
  endDate: string;
  color: string;
  intern: boolean;
  pricePerPerson: number;
  minParticipants: number;
  maxParticipants: number | null;
  bookedCount: number;
  isActive: boolean;
  sortOrder: number;
  roomId: string | null;
  roomName: string | null;
}

export interface RoomEntry {
  id: string;
  name: string;
  description: string;
  image: string;
  capacity: number | null;
  isActive: boolean;
  sortOrder: number;
  available?: boolean; // only present when queried together with a date range
}

export interface InquiryFormData {
  eventId?: string;
  roomId?: string;
  raum?: string; // display name of the chosen room, set alongside roomId for admin/email display
  raumKapazitaet?: number | null; // capacity of the chosen room, for the Step2 participant-count warning
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
