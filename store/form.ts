"use client";
import { create } from "zustand";
import type { InquiryFormData } from "@/lib/types";

interface FormStore {
  form: InquiryFormData;
  setField: <K extends keyof InquiryFormData>(key: K, value: InquiryFormData[K]) => void;
  reset: () => void;
}

const initialForm: InquiryFormData = {
  artTitel: "",
  nameGruppenleitung: "",
  gruppengroesse: "",
  datum: "",
  email: "",
  veranstaltungBeginnEnde: "",
  personenAnzahl: "",
  leiterinnen: "",
  bestuhlung: null,
  tische: null,
  sonstigesEquipment: "",
  verpflegung: "",
  zimmerwunsch: "",
  wuenscheRahmenprogramm: "",
  abrechnung: "",
};

export const useFormStore = create<FormStore>((set) => ({
  form: { ...initialForm },
  setField: (key, value) =>
    set((s) => ({ form: { ...s.form, [key]: value } })),
  reset: () => set({ form: { ...initialForm } }),
}));
