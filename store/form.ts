"use client";
import { create } from "zustand";
import type { InquiryFormData } from "@/lib/types";

interface FormStore {
  form: InquiryFormData;
  step: number;
  setField: <K extends keyof InquiryFormData>(key: K, value: InquiryFormData[K]) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}

const initialForm: InquiryFormData = {
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
  sonstigesEquipment: "",
  verpflegung: "",
  zimmerwunsch: "",
  wuenscheRahmenprogramm: "",
  abrechnung: "",
  telefon: "",
  sprache: "",
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
  reset: () => set({ form: { ...initialForm }, step: 1 }),
}));
