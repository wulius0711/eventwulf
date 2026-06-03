"use client";
import { create } from "zustand";
import type { InquiryFormData } from "@/lib/types";

interface FormStore {
  form: InquiryFormData;
  step: number;
  maxStep: number;
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
  maxStep: 1,
  setField: (key, value) =>
    set((s) => ({ form: { ...s.form, [key]: value } })),
  nextStep: () => set((s) => { const next = Math.min(s.step + 1, TOTAL_STEPS); return { step: next, maxStep: Math.max(s.maxStep, next) }; }),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
  goToStep: (n) => set((s) => { const t = Math.max(1, Math.min(n, TOTAL_STEPS)); return { step: t, maxStep: Math.max(s.maxStep, t) }; }),
  reset: () => set({ form: { ...initialForm }, step: 1, maxStep: 1 }),
}));
