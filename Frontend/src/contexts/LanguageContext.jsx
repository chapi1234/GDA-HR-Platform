import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  resolveStoredLanguage,
  translate,
} from "../i18n";

const LanguageContext = createContext(null);

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    return resolveStoredLanguage();
  });

  const setLanguage = useCallback((next) => {
    const lang = next === "am" ? "am" : "en";
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      const raw = localStorage.getItem("userSettings");
      const settings = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        "userSettings",
        JSON.stringify({ ...settings, language: lang })
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "am" ? "am" : "en";
  }, [language]);

  const t = useCallback(
    (key, vars) => translate(language, key, vars),
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isAmharic: language === "am",
    }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};
