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

import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createClient } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

import {
  createLanguageStore,
  defaultLanguage,
  followProfileLanguage,
  formatDate,
  formatDateTime,
  formatDecimal,
  formatNumber,
  formatTime,
  isoDate,
  LanguageProvider,
  matchLanguage,
  MESSAGES,
  resolveLanguage,
  tokenSubject,
  translate,
  useLanguage,
  weekStart,
  type LanguageStore,
} from '../src/i18n/index.js';
import { Backend, BASE } from './support.js';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
];

function memory(initial: string | null = null) {
  const values = new Map<string, string>(initial === null ? [] : [['bazis.language', initial]]);
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function store(options: { stored?: string | null; preferred?: readonly string[] } = {}): LanguageStore {
  return createLanguageStore({
    languages: LANGUAGES,
    fallback: 'en',
    storage: memory(options.stored ?? null),
    preferred: options.preferred ?? [],
  });
}

describe('translate', () => {
  const product = { 'list.title': 'Tasks', 'state.retry': 'Try again' };
  const ru = { 'list.title': 'Задачи' };

  it('takes the first dictionary that has the key, with its parameters', () => {
    expect(translate([ru, product], 'ru', 'list.title')).toBe('Задачи');
    expect(translate([ru, product], 'ru', 'state.retry')).toBe('Try again');
    expect(translate([{ greet: 'Hello, {name}: {name}! {other}' }], 'en', 'greet', { name: 'Ann' })).toBe(
      'Hello, Ann: Ann! {other}',
    );
    // a missing text shows its key
    expect(translate([product], 'en', 'nothing.here')).toBe('nothing.here');
  });

  it('chooses the plural form of the language by `count`, and formats the numbers in it', () => {
    const messages = [MESSAGES.ru ?? {}, MESSAGES.en ?? {}];
    const unread = (count: number, locale = 'ru') => translate(messages, locale, 'notifications.unread', { count });
    expect([unread(1), unread(2), unread(5), unread(21), unread(1500)]).toEqual([
      'Уведомления, 1 непрочитанное',
      'Уведомления, 2 непрочитанных',
      'Уведомления, 5 непрочитанных',
      'Уведомления, 21 непрочитанное',
      expect.stringMatching(/^Уведомления, 1\s500 непрочитанных$/),
    ]);
    expect(translate([MESSAGES.en ?? {}], 'en', 'notifications.unread', { count: 1500 })).toBe('Notifications, 1,500 unread');
  });

  it('has a Russian text for every text of the package', () => {
    expect(Object.keys(MESSAGES.ru ?? {}).sort()).toEqual(Object.keys(MESSAGES.en ?? {}).sort());
  });
});

describe('the language', () => {
  it('is a language of the backend: the same code, else the same base code', () => {
    expect(matchLanguage(LANGUAGES, 'RU')).toBe('ru');
    expect(matchLanguage(LANGUAGES, 'ru-RU')).toBe('ru');
    expect(matchLanguage(LANGUAGES, 'de')).toBeNull();
    expect(resolveLanguage(LANGUAGES, 'en', [null, 'de-DE', 'ru-RU', 'en'])).toBe('ru');
    expect(resolveLanguage(LANGUAGES, 'en', ['de'])).toBe('en');
  });

  it('falls back to a language of the backend only', () => {
    // the default by its base code, else the first language
    expect(resolveLanguage(LANGUAGES, 'ru-RU', [])).toBe('ru');
    expect(resolveLanguage(LANGUAGES, 'de', ['fr'])).toBe('en');
    expect(defaultLanguage([], 'de')).toBe('de');
    const languages = createLanguageStore({ languages: LANGUAGES, fallback: 'de', storage: null, preferred: [] });
    expect([languages.get(), languages.fallback]).toEqual(['en', 'en']);
  });

  it('is the choice kept in the browser, else that of the browser, else the default of the backend', () => {
    expect(store({ stored: 'ru', preferred: ['en-US'] }).get()).toBe('ru');
    expect(store({ stored: 'de', preferred: ['de-DE', 'ru-RU'] }).get()).toBe('ru');
    expect(store({ preferred: ['fr'] }).get()).toBe('en');
  });

  it('changes to a language of the backend only, keeps it and tells the listeners', () => {
    const storage = memory();
    const languages = createLanguageStore({ languages: LANGUAGES, fallback: 'en', storage, preferred: [] });
    const listener = vi.fn();
    const unsubscribe = languages.subscribe(listener);
    languages.set('de');
    languages.set('en');
    expect(listener).not.toHaveBeenCalled();
    languages.set('ru-RU');
    expect([languages.get(), storage.values.get('bazis.language'), listener.mock.calls.length]).toEqual(['ru', 'ru', 1]);
    unsubscribe();
    languages.set('en');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('LanguageProvider', () => {
  function Texts() {
    const { language, languages, t } = useLanguage();
    return (
      <p data-language={language} data-languages={languages.map((it) => it.code).join(',')}>
        {t('state.retry')} {t('nav.home')}
      </p>
    );
  }

  it('is English without a provider, and the language of the store with the dictionaries of the product over those of the package', () => {
    const { rerender } = render(<Texts />);
    expect(screen.getByText(/Retry/).textContent).toBe('Retry nav.home');

    const languages = store();
    const product = { en: { 'nav.home': 'Home' }, ru: { 'nav.home': 'Главная', 'state.retry': 'Ещё раз' } };
    function Switch({ children }: { children: ReactNode }) {
      return (
        <LanguageProvider store={languages} messages={product}>
          {children}
        </LanguageProvider>
      );
    }
    rerender(
      <Switch>
        <Texts />
      </Switch>,
    );
    const text = () => screen.getByText(/Retry|Ещё/);
    expect(text().textContent).toBe('Retry Home');
    expect(text().dataset.languages).toBe('en,ru');
    act(() => {
      languages.set('ru');
    });
    expect([text().textContent, text().dataset.language]).toEqual(['Ещё раз Главная', 'ru']);
  });

  it('changes the language with setLanguage', () => {
    const languages = store();
    const { result } = renderHook(() => useLanguage(), {
      wrapper: ({ children }) => <LanguageProvider store={languages}>{children}</LanguageProvider>,
    });
    act(() => {
      result.current.setLanguage('ru');
    });
    expect([languages.get(), result.current.t('state.retry')]).toEqual(['ru', 'Повторить']);
  });
});

describe('the formats', () => {
  it('give the first day of the week of a language and the day of a date', () => {
    expect(weekStart('ru')).toBe(1);
    expect(weekStart('en-US')).toBe(7);
    expect(isoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('are those of the language of the interface', () => {
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(formatNumber(1234.5, 'ru')).toMatch(/^1\s234,5$/);
    // the spaces of the formats depend on the version of ICU
    expect(formatDate('2026-10-08', 'en')).toBe('Oct 8, 2026');
    expect(formatDate('2026-10-08', 'ru')).toMatch(/^8 окт\. 2026\sг\.$/);
    // a date of the backend is that day wherever the user is; another text stays as it is
    expect(formatDate('soon', 'en')).toBe('soon');
    const moment = new Date(2026, 9, 8, 15, 4);
    expect(formatDateTime(moment, 'ru')).toMatch(/^8 окт\. 2026\sг\., 15:04$/);
    expect(formatDateTime(moment, 'en')).toMatch(/^Oct 8, 2026, 3:04\sPM$/);
    expect(formatDateTime('later', 'en')).toBe('later');
    expect(formatTime(moment, 'ru')).toBe('15:04');
  });

  it('format a decimal of the backend, a string, exactly with its digits after the point', () => {
    expect(formatDecimal('45000.10', 'en')).toBe('45,000.10');
    expect(formatDecimal('45000.10', 'ru')).toMatch(/^45\s000,10$/);
    expect(formatDecimal('-7', 'en')).toBe('-7');
    // more digits than a double keeps
    expect(formatDecimal('12345678901234567.89', 'en')).toBe('12,345,678,901,234,567.89');
    // a sum, in the currency of the product
    expect(formatDecimal('1500.50', 'ru', { style: 'currency', currency: 'RUB' })).toMatch(/^1\s500,50\s₽$/);
    expect(formatDecimal('1500.50', 'en', { maximumFractionDigits: 0 })).toBe('1,501');
    // only the minimum: the maximum of Intl, never below it
    expect(formatDecimal('1.5', 'en', { minimumFractionDigits: 2 })).toBe('1.50');
    expect(formatDecimal('1.23456', 'en', { minimumFractionDigits: 2 })).toBe('1.235');
    // the exponent of Python for a small value of a field with 7 decimal places or more
    expect(formatDecimal('0E-8', 'en')).toBe('0.00000000');
    expect(formatDecimal('1.0E-7', 'en')).toBe('0.00000010');
    expect(formatDecimal('1.5E+3', 'ru')).toMatch(/^1\s500$/);
    expect(formatDecimal(1234.5, 'en')).toBe('1,234.5');
    expect(formatDecimal('n/a', 'en')).toBe('n/a');
    // the value of a field as it is: none is shown as FieldValue shows it
    expect(formatDecimal(null, 'en')).toBe('—');
    expect(formatDecimal(undefined, 'en')).toBe('—');
  });
});

describe('the language of the profile', () => {
  const USERS = '/api/v1/users/user/';
  const RESOURCE = { path: USERS, type: 'users.user' };
  // a session JWT of bazis-users: the username in `sub`
  const token = `header.${btoa(JSON.stringify({ sub: 'manager', exp: 1 })).replace(/=+$/, '')}.signature`;
  const found = (language: string | null) => ({
    data: [{ id: 'u1', type: 'users.user', attributes: { username: 'manager', language } }],
  });

  function setup(language: string | null) {
    const backend = new Backend()
      .on('GET', `${USERS}?filter=username%3Dmanager&page%5Blimit%5D=1`, found(language))
      .on('PATCH', `${USERS}u1/`, found(language).data[0]);
    const api = createClient<paths>({ baseUrl: BASE, fetch: backend.fetch });
    return { backend, api };
  }

  it('reads the username of a session token', () => {
    expect(tokenSubject(token)).toBe('manager');
    expect(tokenSubject('anonymous-token-0123456789')).toBeNull();
  });

  it('is adopted at a login, and every change of the language is saved to it', async () => {
    const { backend, api } = setup('ru');
    const languages = store();
    const stop = followProfileLanguage(languages, api, RESOURCE, token);
    await vi.waitFor(() => {
      expect(languages.get()).toBe('ru');
    });
    // adopted, not saved again
    expect(backend.requests('PATCH')).toEqual([]);
    languages.set('en');
    await vi.waitFor(() => {
      expect(backend.requests('PATCH')).toEqual([`PATCH ${USERS}u1/`]);
    });
    expect(backend.calls.at(-1)?.body).toEqual({ data: { type: 'users.user', id: 'u1', attributes: { language: 'en' } } });
    // a logout: the changes are no longer saved
    stop();
    languages.set('ru');
    await Promise.resolve();
    expect(backend.requests('PATCH')).toHaveLength(1);
  });

  it('is never written at a login: only a change of the user is saved', async () => {
    const { backend, api } = setup(null);
    const languages = store({ stored: 'ru' });
    followProfileLanguage(languages, api, RESOURCE, token);
    await vi.waitFor(() => {
      expect(backend.requests('GET')).toHaveLength(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect([languages.get(), backend.requests('PATCH')]).toEqual(['ru', []]);
    languages.set('en');
    await vi.waitFor(() => {
      expect(backend.calls.find((it) => it.method === 'PATCH')?.body).toEqual({
        data: { type: 'users.user', id: 'u1', attributes: { language: 'en' } },
      });
    });
  });

  it('keeps the language chosen in the browser when the profile refuses it (422)', async () => {
    const backend = new Backend()
      .on('GET', `${USERS}?filter=username%3Dmanager&page%5Blimit%5D=1`, found(null))
      .on(
        'PATCH',
        `${USERS}u1/`,
        { errors: [{ status: 422, detail: 'The language must be one of: en', source: { pointer: '/data/attributes/language' } }] },
        422,
      );
    const api = createClient<paths>({ baseUrl: BASE, fetch: backend.fetch });
    const storage = memory();
    const languages = createLanguageStore({ languages: LANGUAGES, fallback: 'en', storage, preferred: [] });
    followProfileLanguage(languages, api, RESOURCE, token);
    await vi.waitFor(() => {
      expect(backend.requests('GET')).toHaveLength(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    languages.set('ru');
    await vi.waitFor(() => {
      expect(backend.requests('PATCH')).toEqual([`PATCH ${USERS}u1/`]);
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    // the refusal of the backend changes nothing in the page: the language stays, kept in the browser
    expect([languages.get(), storage.values.get('bazis.language')]).toEqual(['ru', 'ru']);
  });

  it('keeps a change of the user made while the profile loads, and saves it', async () => {
    const { backend, api } = setup('ru');
    const release = backend.hold('GET', `${USERS}?filter=username%3Dmanager&page%5Blimit%5D=1`);
    const languages = store();
    followProfileLanguage(languages, api, RESOURCE, token);
    languages.set('en');
    languages.set('ru');
    languages.set('en');
    release();
    await vi.waitFor(() => {
      expect(backend.requests('PATCH')).toEqual([`PATCH ${USERS}u1/`]);
    });
    // the language of the profile does not replace the choice of the user
    expect(languages.get()).toBe('en');
    expect(backend.calls.at(-1)?.body).toEqual({ data: { type: 'users.user', id: 'u1', attributes: { language: 'en' } } });
  });
});
