import React, { createContext, useContext, useState, useCallback } from "react";
import { type TranslationKey, t, getStoredLanguage, setStoredLanguage } from "@/lib/i18n";

type LanguageContextType = {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<string>(getStoredLanguage);

  const setLang = useCallback((newLang: string) => {
    setLangState(newLang);
    setStoredLanguage(newLang);
  }, []);

  const translate = useCallback(
    (key: TranslationKey) => t(key, lang),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
