"use client";
import { createContext, useContext, useEffect, useState, useMemo, useCallback, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { translations } from "@/i18n/translations";

type Language = "ar" | "en";
interface I18nValue { lang: Language; setLang: Dispatch<SetStateAction<Language>>; t(key: string): string; dir: "rtl" | "ltr" }
const I18nContext = createContext<I18nValue | null>(null);
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("ar");
  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "ar" || stored === "en") setLang(stored);
  }, []);
  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.body.classList.toggle("font-arabic", lang === "ar");
    document.body.classList.toggle("font-english", lang === "en");
    localStorage.setItem("lang", lang);
  }, [lang]);
  const t = useCallback((key: string) => {
    const dictionaries = translations as Record<Language, Record<string, string>>;
    return dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
  }, [lang]);
  const value = useMemo<I18nValue>(() => ({ lang, setLang, t, dir: lang === "ar" ? "rtl" : "ltr" }), [lang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
