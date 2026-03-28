import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type LocaleMessages = Record<string, unknown>;

export type TParams = Record<string, string | number | boolean | null | undefined>;

export type TFunction = (key: string, params?: TParams) => string;

export interface I18nContextValue {
  locale: string;
  setLocale: (nextLocale: string) => void;
  availableLocales: string[];
  t: TFunction;
}

const LOCALE_STORAGE_KEY = 'app_locale';
const DEFAULT_LOCALE = 'zh_CN';
const RTL_LOCALES = new Set(['ar', 'fa', 'he', 'ur']);

const localeModules = (import.meta as any).glob('./locales/*.json', { eager: true }) as Record<
  string,
  { default: LocaleMessages }
>;

function normalizeLocale(locale: string) {
  return locale.trim().replace('-', '_');
}

export function isRtlLocale(locale: string) {
  const normalized = normalizeLocale(locale).toLowerCase();
  const base = normalized.split('_')[0];
  return RTL_LOCALES.has(normalized) || RTL_LOCALES.has(base);
}

function extractLocaleFromPath(modulePath: string) {
  const fileName = modulePath.split('/').pop() ?? '';
  return fileName.replace(/\.json$/i, '');
}

function getByPath(source: LocaleMessages, path: string) {
  const parts = path.split('.').filter(Boolean);
  let cursor: unknown = source;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && part in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}

function interpolate(template: string, params: TParams | undefined) {
  if (!params) return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const value = params[key];
    if (value === null || value === undefined) return match;
    return String(value);
  });
}

function resolveMessages(locale: string) {
  const normalized = normalizeLocale(locale);
  const candidates = [normalized, normalized.toLowerCase()];
  const available = Object.keys(localeModules).map(extractLocaleFromPath);

  const match = candidates.find((c) => available.includes(c));
  if (match) {
    const modulePath = Object.keys(localeModules).find((p) => extractLocaleFromPath(p) === match);
    if (modulePath) return localeModules[modulePath].default;
  }

  const defaultPath = Object.keys(localeModules).find((p) => extractLocaleFromPath(p) === DEFAULT_LOCALE);
  if (defaultPath) return localeModules[defaultPath].default;

  return {};
}

function getAvailableLocales() {
  return Object.keys(localeModules).map(extractLocaleFromPath).sort();
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  availableLocales: getAvailableLocales(),
  t: (key, params) => interpolate(key, params),
});

export const I18nProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [locale, setLocaleState] = useState(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return normalizeLocale(stored || DEFAULT_LOCALE);
  });

  const setLocale = useCallback((nextLocale: string) => {
    const normalized = normalizeLocale(nextLocale);
    setLocaleState(normalized);
    localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
  }, []);

  const t = useCallback<TFunction>(
    (key, params) => {
      const messages = resolveMessages(locale);
      const value = getByPath(messages, key);
      if (typeof value === 'string') return interpolate(value, params);
      return key;
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      availableLocales: getAvailableLocales(),
      t,
    }),
    [locale, setLocale, t]
  );

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale.replace('_', '-');
    html.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useI18n().t;
}
