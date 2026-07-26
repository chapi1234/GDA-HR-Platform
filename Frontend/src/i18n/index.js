import en from "./locales/en";
import am from "./locales/am";

export const SUPPORTED_LANGUAGES = [
  { value: "en", labelKey: "settings.languageEn" },
  { value: "am", labelKey: "settings.languageAm" },
];

export const DEFAULT_LANGUAGE = "en";
export const LANGUAGE_STORAGE_KEY = "appLanguage";

const dictionaries = { en, am };

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}

/**
 * Translate a dotted key. Falls back to English, then the key itself.
 * Supports {{var}} interpolation from `vars`.
 */
export function translate(lang, key, vars = {}) {
  const dict = dictionaries[lang] || dictionaries[DEFAULT_LANGUAGE];
  let text =
    getByPath(dict, key) ??
    getByPath(dictionaries[DEFAULT_LANGUAGE], key) ??
    key;

  if (typeof text !== "string") return key;

  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = vars[name];
    return v == null ? "" : String(v);
  });
}

export function resolveStoredLanguage() {
  try {
    const direct = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (direct === "en" || direct === "am") return direct;

    const raw = localStorage.getItem("userSettings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.language === "en" || parsed?.language === "am") {
        return parsed.language;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_LANGUAGE;
}
