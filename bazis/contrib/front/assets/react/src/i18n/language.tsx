// Copyright 2026 EcoFuture Technology Services LLC and contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// The language of the interface: one of the languages of the backend (`LANGUAGES` of the
// contract), chosen in this order: the language of the profile of the user (set by the
// application at a login), the choice kept in the browser (localStorage), the languages of
// the browser (`navigator.languages`), the default language of the backend (`LANGUAGE`).
// `LanguageProvider` gives the components the language and `t`; without it they are in
// English and the language cannot change.

import { createContext, use, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { en } from './messages/en.js';
import { ru } from './messages/ru.js';
import { translate, type Messages, type Params, type Translate } from './translate.js';

/** A language of the backend: its code (`ru`, `pt-br`) and its name. */
export interface Language {
  readonly code: string;
  readonly name: string;
}

/** The dictionaries of the package, by language: those of the product are merged over them. */
export const MESSAGES: Readonly<Record<string, Messages>> = { en, ru };

/** The key of the language chosen by the user in localStorage. */
export const LANGUAGE_KEY = 'bazis.language';

/** The language of the texts of the package without a dictionary of the language. */
const BASE = 'en';

/** The base code of a language code: `pt` of `pt-BR`. */
export function baseLanguage(code: string): string {
  return code.split(/[-_]/)[0]?.toLowerCase() ?? code;
}

/**
 * The language of `languages` that a code names: the same code (whatever its case and
 * separator), else the same base code (`ru` for `ru-RU`); null for none.
 */
export function matchLanguage(languages: readonly Language[], code: string | null | undefined): string | null {
  if (!code) return null;
  const wanted = code.toLowerCase().replace('_', '-');
  const same = languages.find((it) => it.code.toLowerCase().replace('_', '-') === wanted);
  if (same) return same.code;
  const base = baseLanguage(wanted);
  return languages.find((it) => baseLanguage(it.code) === base)?.code ?? null;
}

/** The first of the candidates that is a language of `languages`, else the default one. */
export function resolveLanguage(
  languages: readonly Language[],
  fallback: string,
  candidates: readonly (string | null | undefined)[],
): string {
  for (const candidate of candidates) {
    const code = matchLanguage(languages, candidate);
    if (code !== null) return code;
  }
  return fallback;
}

/** The current language and its changes, outside React too (the client sends it to the backend). */
export interface LanguageStore {
  readonly languages: readonly Language[];
  /** The default language of the backend (`LANGUAGE`). */
  readonly fallback: string;
  get: () => string;
  /** Changes the language (a language of `languages`; another code is ignored) and keeps it in the browser. */
  set: (code: string) => void;
  /** Calls the listener when the language changes; returns the unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
}

export interface LanguageStoreOptions {
  /** `LANGUAGES` of the contract. */
  languages: readonly Language[];
  /** `LANGUAGE` of the contract. */
  fallback: string;
  /** Where the choice of the user is kept; localStorage by default, null for nowhere. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** The languages of the browser; `navigator.languages` by default. */
  preferred?: readonly string[];
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return globalThis.localStorage;
  } catch {
    // no storage (a private mode): the choice lasts until the page is closed
    return null;
  }
}

/**
 * The language of the interface, resolved from the choice kept in the browser, the
 * languages of the browser and the default language of the backend.
 */
export function createLanguageStore({
  languages,
  fallback,
  storage = defaultStorage(),
  preferred = typeof navigator === 'undefined' ? [] : navigator.languages,
}: LanguageStoreOptions): LanguageStore {
  let stored: string | null;
  try {
    stored = storage?.getItem(LANGUAGE_KEY) ?? null;
  } catch {
    stored = null;
  }
  let current = resolveLanguage(languages, fallback, [stored, ...preferred]);
  const listeners = new Set<() => void>();
  return {
    languages,
    fallback,
    get: () => current,
    set: (code) => {
      const next = matchLanguage(languages, code);
      if (next === null || next === current) return;
      current = next;
      try {
        storage?.setItem(LANGUAGE_KEY, next);
      } catch {
        // a storage that is not available: the language lasts until the page is reloaded
      }
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** What `useLanguage` gives. */
export interface LanguageContextValue {
  /** The code of the current language (`en`); also the locale of `Intl`. */
  language: string;
  /** The languages the user may choose: those of the backend. */
  languages: readonly Language[];
  setLanguage: (code: string) => void;
  /** The text of a key in the current language. */
  t: Translate;
}

/** The dictionaries of a language, the first one first: the product's, then the package's. */
function dictionaries(language: string, fallback: string, product: Readonly<Record<string, Messages>>): Messages[] {
  const codes = [...new Set([language, baseLanguage(language), fallback, baseLanguage(fallback), BASE])];
  return codes.flatMap((code) => [product[code], MESSAGES[code]]).filter((it): it is Messages => it !== undefined);
}

function context(
  language: string,
  fallback: string,
  languages: readonly Language[],
  setLanguage: (code: string) => void,
  product: Readonly<Record<string, Messages>>,
): LanguageContextValue {
  const chain = dictionaries(language, fallback, product);
  return { language, languages, setLanguage, t: (key: string, params?: Params) => translate(chain, language, key, params) };
}

/**
 * The texts of the package in English: the default of the components without a
 * `LanguageProvider`, and of the functions that format outside a component.
 */
export const ENGLISH: LanguageContextValue = context(BASE, BASE, [], () => undefined, {});

const LanguageContext = createContext<LanguageContextValue>(ENGLISH);

/** A store whose language never changes: the default of `LanguageProvider`, and the tests. */
const fixed = (code: string): LanguageStore => ({
  languages: [],
  fallback: code,
  get: () => code,
  set: () => undefined,
  subscribe: () => () => undefined,
});

export interface LanguageProviderProps {
  /** The language of the interface (`createLanguageStore`); English, fixed, without it. */
  store?: LanguageStore;
  /** The dictionaries of the product by language (`src/i18n/`), merged over those of the package. */
  messages?: Readonly<Record<string, Messages>>;
  children: ReactNode;
}

const ENGLISH_STORE = fixed(BASE);
const NO_MESSAGES: Readonly<Record<string, Messages>> = {};

/** Gives the components the language of the store and the texts of the dictionaries. */
export function LanguageProvider({ store = ENGLISH_STORE, messages = NO_MESSAGES, children }: LanguageProviderProps) {
  const language = useSyncExternalStore(store.subscribe, store.get, store.get);
  const value = useMemo(
    () => context(language, store.fallback, store.languages, store.set, messages),
    [language, store, messages],
  );
  return <LanguageContext value={value}>{children}</LanguageContext>;
}

/**
 * The language of the interface: `{language, languages, setLanguage, t}`. Without a
 * `LanguageProvider`, English with the texts of the package.
 */
export function useLanguage(): LanguageContextValue {
  return use(LanguageContext);
}
