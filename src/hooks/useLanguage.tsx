/**
 * ARTIXO Language Context
 * Supports: "en" (English) | "ta" (Tamil)
 * Persisted in localStorage so it survives page refresh.
 */

import { createContext, useContext, useState, ReactNode } from "react";

export type Lang = "en" | "ta";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  isTamil: boolean;
}

const LangContext = createContext<LangCtx>({ lang: "en", setLang: () => {}, isTamil: false });

const STORAGE_KEY = "artixo_lang";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem(STORAGE_KEY) as Lang) || "en"; } catch { return "en"; }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  };

  return (
    <LangContext.Provider value={{ lang, setLang, isTamil: lang === "ta" }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLanguage = () => useContext(LangContext);
