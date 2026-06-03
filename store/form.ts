"use client";
import { create } from "zustand";
import type { InquiryFormData } from "@/lib/types";

interface FormStore {
  form: InquiryFormData;
  step: number;
  setField: <K extends keyof InquiryFormData>(key: K, value: InquiryFormData[K]) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (n: number) => void;
  reset: () => void;
}

const initialForm: InquiryFormData = {
  packageId: "",
  artTitel: "",
  nameGruppenleitung: "",
  datumVon: "",
  datumBis: "",
  email: "",
  zeitVon: "",
  zeitBis: "",
  personenAnzahl: "",
  leiterinnen: "",
  bestuhlung: null,
  tische: null,
  beamer: null,
  soundanlage: null,
  aussenbereich: null,
  sonstigesEquipment: "",
  ausstattungExtra: [],
  verpflegung: "",
  zimmerwunsch: "",
  wuenscheRahmenprogramm: "",
  abrechnung: "",
  telefon: "",
  sprache: "",
  zahlung: "",
  anreise: "",
  barrierefreiheit: "",
  budget: "",
  quelle: "",
};

export const TOTAL_STEPS = 5;

export const useFormStore = create<FormStore>((set) => ({
  form: { ...initialForm },
  step: 1,
  setField: (key, value) =>
    set((s) => ({ form: { ...s.form, [key]: value } })),
  nextStep: () => set((s) => ({ step: Math.min(s.step + 1, TOTAL_STEPS) })),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
  goToStep: (n) => set((s) => ({ step: Math.max(1, Math.min(n, TOTAL_STEPS)) })),
  reset: () => set({ form: { ...initialForm }, step: 1 }),
}));
