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

// The screenshots of the screens and the checks of what they render, for the visual check of
// a frontend: `manage.py bazis_front shots` generates `e2e/generated/shots.ts`, which calls
// `shoot` for every screen of the specs, runs it with playwright.shots.config.ts and gathers
// the results that `shoot` writes into `.scratch/shots/report.json`.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, type Page, type Response, type TestInfo } from '@playwright/test';

import { App, bz, loginAs, stubForeignImages, type Product, type Role, type ScreenId } from '.';

/** The checks of a screenshot: their severity and what they find. */
export const CODES = {
  V001: ['error', 'the screen was not shot: the login, the route, the item to open or the run failed'],
  V002: ['error', 'the page scrolls sideways at the width of a phone'],
  V003: ['warning', 'a part of the page scrolls sideways at the width of a phone (a table where cards would fit), not a board'],
  V004: ['error', 'a label shows a raw name: a column, a term of a card, a label of a field or a filter, a heading that is a snake_case name, an id or a key of the translations'],
  V005: ['error', 'the screen shows a UUID, the id of an item instead of its label'],
  V006: ['error', 'a text has a contrast below 4.5:1 (3:1 for a large text) on its background, as rendered'],
  V007: ['warning', 'a light surface in the dark mode: a literal color that ignores the tokens of the theme'],
  V008: ['warning', 'an empty state without a text, or without the action that creates an item when the user may create one'],
  V009: ['warning', 'controls smaller than 44×44 px at the width of a phone, one issue for the screenshot with their number'],
  V010: ['warning', 'a text cut by an ellipsis without its whole text in a title or a tooltip'],
  V011: ['error', 'an error of the page that nothing caught (`pageerror`)'],
  V012: ['warning', 'an error written to the console (`console.error`: a warning of React, a failure that the page handles)'],
  V013: ['error', 'a request of the page to the API failed or was answered with an error status, but the refusals that a screen shows as its state'],
  V014: ['error', 'the page scrolls sideways at the width of a desktop'],
  V015: ['error', 'the page scrolls sideways once the texts of its items are long: a text of 120 characters with a word of 40 put in their cells and fields (`data-text`, not a date, a number or the label of a choice) for the check, then taken out'],
  V016: ['warning', 'a list, a board, a calendar or the last items of a dashboard show no item, but the list searched for nothing: the screenshot does not show them'],
  V017: ['warning', 'a text cut by an ellipsis to a few characters: its box is narrower than 4 em, too narrow to be read (the item of a narrow day of a calendar, a narrow column)'],
  V018: ['warning', 'a part of the page that scrolls sideways (a table) grows wider than it is once the texts of its items are long (the texts of V015): a column whose texts do not wrap'],
} as const;

/** A code of the checks of a screenshot. */
export type Code = keyof typeof CODES;

/** An issue of a screenshot: its code, the element (its nearest mark) and what is wrong. */
export interface ShotIssue {
  readonly code: Code;
  readonly severity: (typeof CODES)[Code][0];
  readonly selector: string;
  readonly message: string;
}

/** A screenshot of the generated `shots.ts`. */
export interface Shot<P extends Product = Product> {
  /** The screen shot. */
  readonly screen: ScreenId<P>;
  /** The role whose test user is logged in; null when nobody logs in. */
  readonly role: Role<P> | null;
  readonly mode: 'light' | 'dark';
  /**
   * The screen whose first item opens the screen of an item (its route has an id), and the
   * mark of its part with that item (`recent:<id>` of a dashboard), null for the screen.
   */
  readonly via: { readonly screen: ScreenId<P>; readonly part: string | null } | null;
  /** The actions of the screen that create an item, which its empty state offers. */
  readonly creates: readonly string[];
  /**
   * What is shown on the screen of a list: null for the screen as it opens, `empty` its list
   * searched for a text that no item has, `form` its first form that creates an item, open.
   */
  readonly variant: 'empty' | 'form' | null;
}

/** The result of a screenshot, `<screen>-<role>-<mode>-<width>.json` in the directory of the shots. */
export interface ShotResult {
  readonly screen: string;
  readonly role: string | null;
  readonly mode: 'light' | 'dark';
  readonly width: number;
  readonly variant: 'empty' | 'form' | null;
  /** The screenshot, relative to the directory of the shots; null when it was not taken. */
  readonly file: string | null;
  readonly issues: readonly ShotIssue[];
}

/** The widest viewport that is a phone. */
const PHONE = 480;

/** The issues of one code reported for a screenshot, the last of them with the number of the others. */
const MAX_ISSUES = 10;

/**
 * The directory of the screenshots and their results: BAZIS_SHOTS_DIR (set by
 * `manage.py bazis_front shots`), else `.scratch/shots/` next to the config of the run.
 */
function shotsDir(info: TestInfo): string {
  const root = info.config.configFile ? path.dirname(info.config.configFile) : info.config.rootDir;
  return process.env.BAZIS_SHOTS_DIR ?? path.join(root, '.scratch', 'shots');
}

/** The search of the screenshot of an empty list (`variant: 'empty'`): a text that no item has. */
const NOTHING = 'bazis-shots-match-nothing';

/** A message of Playwright or of the page without its colors, on one line. */
function oneLine(text: string, length = 400): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim().slice(0, length);
}

/**
 * Opens a screen as the test user of the role (the screen of an item through the first item of
 * `via`, in its part; the list searched or its form open, `variant`), waits until nothing loads,
 * checks what it renders (`check`) and what the page did once the user was logged in (`listen`)
 * and takes a screenshot of the whole page; writes the screenshot and its result into the
 * directory of the shots (`shotsDir`). A screen that cannot be reached is the issue V001 of
 * its result, and fails the test.
 */
export async function shoot<P extends Product>(page: Page, product: P, shot: Shot<P>, info: TestInfo): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  const shown = shot.variant === null ? shot.screen : `${shot.screen}.${shot.variant}`;
  const name = [shown, shot.role ?? 'nobody', shot.mode, String(width)].join('-');
  const directory = shotsDir(info);
  mkdirSync(directory, { recursive: true });
  const write = (result: ShotResult) => {
    writeFileSync(path.join(directory, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);
  };
  const base = { screen: shot.screen, role: shot.role, mode: shot.mode, width, variant: shot.variant };
  let heard = (): ShotIssue[] => [];
  try {
    const app = await enter(page, product, shot);
    heard = listen(page);
    await reach(page, app, shot);
    // the empty state of a search offers no creation: its text only is checked
    const searched = shot.variant === 'empty';
    const creates = searched ? [] : shot.creates;
    const issues = await check(page, { phone: width <= PHONE, dark: shot.mode === 'dark', creates, searched });
    await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
    write({ ...base, file: `${name}.png`, issues: [...issues, ...heard()] });
  } catch (error) {
    const message = oneLine(error instanceof Error ? error.message : String(error));
    const issue: ShotIssue = { code: 'V001', severity: CODES.V001[0], selector: bz('screen', shot.screen), message };
    write({ ...base, file: null, issues: [issue, ...heard()] });
    throw error;
  }
}

/** Logs in as the test user of the role of a shot, or opens the pages without a login. */
async function enter<P extends Product>(page: Page, product: P, shot: Shot<P>): Promise<App<P>> {
  if (shot.role !== null) return loginAs(page, product, shot.role);
  await stubForeignImages(page);
  return new App(page, product);
}

/**
 * A refusal that a screen shows as its state, not an error of the page: 403 and 404 of what
 * it reads (`state:forbidden`, `state:not_found`), but of the fields of its filters
 * (`route_filter_fields/`), which no screen shows as its state: the route set does not route
 * them.
 */
function expected(response: Response): boolean {
  return (
    [403, 404].includes(response.status()) &&
    response.request().method() === 'GET' &&
    !new URL(response.url()).pathname.endsWith('/route_filter_fields/')
  );
}

/**
 * An answer of the proxy of the dev server of Vite that did not reach the backend, not of the
 * backend: a 500 of the type `text/plain` without a charset and without a body (its error is
 * in the output of the dev server), where Bazis answers JSON and Starlette a text with its
 * charset.
 */
function unproxied(response: Response): boolean {
  return response.status() === 500 && response.headers()['content-type'] === 'text/plain';
}

/**
 * Listens to the page from now on: its errors that nothing caught (V011), the errors written
 * to its console (V012, but the failed loads of resources, which V013 reports), and its
 * requests to the API (`/api/`) that failed or were answered with an error status (V013, but
 * the refusals that a screen shows as its state and the requests that the page cancelled);
 * returns what it heard so far, at most `MAX_ISSUES` of each code.
 */
function listen(page: Page): () => ShotIssue[] {
  const heard: Found[] = [];
  const api = (url: string) => new URL(url).pathname.startsWith('/api/');
  page.on('pageerror', (error) => {
    heard.push({ code: 'V011', selector: 'page', message: oneLine(error.message) });
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      heard.push({ code: 'V012', selector: 'console', message: oneLine(message.text()) });
    }
  });
  page.on('response', (response) => {
    if (!api(response.url()) || response.status() < 400 || expected(response)) return;
    const { pathname } = new URL(response.url());
    const status = `${String(response.status())} ${response.statusText()}`.trim();
    const message = unproxied(response)
      ? `${status}: the proxy of the dev server did not reach the backend (its output says why), not an answer of the backend; take the screenshots again`
      : status;
    heard.push({ code: 'V013', selector: `${response.request().method()} ${pathname}`, message });
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    if (!api(request.url()) || failure === 'net::ERR_ABORTED') return;
    heard.push({ code: 'V013', selector: `${request.method()} ${new URL(request.url()).pathname}`, message: failure });
  });
  return () => capped(heard.map((it) => ({ ...it, severity: CODES[it.code][0] })));
}

/** Opens the screen of a shot and waits until it has rendered a state and nothing loads. */
async function reach<P extends Product>(page: Page, app: App<P>, shot: Shot<P>): Promise<void> {
  if (shot.via === null) {
    await app.open(shot.screen);
  } else {
    const { screen, part } = shot.via;
    await app.open(screen);
    await expect(page.locator(bz('state', 'loading'))).toHaveCount(0);
    const scope = part === null ? app.screen() : app.screen().locator(`[data-bz="${part}"]`);
    const rows = scope.locator('[data-bz^="row:"]');
    if ((await rows.count()) === 0) {
      throw new Error(`The screen ${screen}${part === null ? '' : ` (${part})`} has no item to open ${shot.screen} with.`);
    }
    await rows.first().click();
    await app.expectScreen(shot.screen);
  }
  await expect(app.screen().locator('[data-bz^="state:"]').first()).toBeAttached();
  await expect(page.locator(bz('state', 'loading'))).toHaveCount(0);
  if (shot.variant === 'empty') await app.search(NOTHING);
  const [create] = shot.creates;
  if (shot.variant === 'form' && create !== undefined) {
    await app.action(create);
    await expect(app.form()).toBeVisible();
    await expect(page.locator(bz('state', 'loading'))).toHaveCount(0);
    // the dialog of the form at its size, not in its opening animation (a spinner never ends)
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((it) => it.effect?.getComputedTiming().endTime !== Infinity)
          .map((it) => it.finished),
      ).then(() => undefined),
    );
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/**
 * What `check` checks: the width of a phone, the dark mode, the actions that create an item,
 * whether the list is searched for nothing (its items are not shown on purpose).
 */
export interface CheckOptions {
  readonly phone: boolean;
  readonly dark: boolean;
  readonly creates: readonly string[];
  readonly searched: boolean;
}

/**
 * The issues of what the page renders (the codes of `CODES`: V002 to V010, V014 to V018), at most
 * `MAX_ISSUES` of each code (`capped`).
 */
export async function check(page: Page, options: CheckOptions): Promise<ShotIssue[]> {
  const found = await page.evaluate(audit, options);
  return capped(found.map((it) => ({ ...it, severity: CODES[it.code][0] })));
}

/** At most `MAX_ISSUES` of each code, the last of them with the number of the others. */
function capped(issues: readonly ShotIssue[]): ShotIssue[] {
  const kept: ShotIssue[] = [];
  const counts = new Map<Code, number>();
  for (const issue of issues) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  for (const [code, count] of counts) {
    const ofCode = issues.filter((it) => it.code === code).slice(0, MAX_ISSUES);
    const last = ofCode.at(-1);
    if (last && count > MAX_ISSUES) ofCode[ofCode.length - 1] = { ...last, message: `${last.message} (and ${String(count - MAX_ISSUES)} more)` };
    kept.push(...ofCode);
  }
  return kept;
}

type Found = Omit<ShotIssue, 'severity'>;

/**
 * The checks, run in the page: self-contained, as `page.evaluate` sends its source. The colors
 * are those that the browser computes, converted to sRGB by a canvas (a token may be `oklch`).
 */
function audit(options: CheckOptions): Found[] {
  /** The small controls named in the one issue V009 of a screenshot. */
  const SMALL_LISTED = 5;
  const issues: Found[] = [];
  const add = (code: Code, element: Element, message: string) => {
    issues.push({ code, selector: describe(element), message });
  };

  /** The nearest mark of the element, and its tag when it is not the marked element. */
  function describe(element: Element): string {
    const marked = element.closest('[data-bz]');
    const tag = element.tagName.toLowerCase();
    if (marked === null) return element.id ? `${tag}#${element.id}` : tag;
    const mark = `[data-bz="${marked.getAttribute('data-bz') ?? ''}"]`;
    return marked === element ? mark : `${mark} ${tag}`;
  }

  const shown = (element: Element) =>
    element.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
    element.getClientRects().length > 0;
  const text = (element: Element) => element.textContent.replace(/\s+/g, ' ').trim();
  const quote = (value: string) => JSON.stringify(value.length > 60 ? `${value.slice(0, 57)}…` : value);

  // the colors in sRGB, 0..255 with an alpha 0..1
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = (color: string): [number, number, number, number] | null => {
    if (context === null) return null;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = '#000';
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const luminance = ([r, g, b]: readonly number[]) => {
    const channel = (value = 0) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const over = (top: readonly number[], bottom: readonly number[]) => {
    const alpha = top[3] ?? 1;
    return [0, 1, 2].map((i) => (top[i] ?? 0) * alpha + (bottom[i] ?? 0) * (1 - alpha));
  };
  /** The background behind the element, opaque; null over an image or a gradient. */
  const background = (element: Element): number[] | null => {
    const layers: number[][] = [];
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none') return null;
      const color = rgba(style.backgroundColor);
      if (color === null) return null;
      if (color[3] > 0) layers.push(color);
      if (color[3] >= 1) break;
    }
    let result = options.dark ? [0, 0, 0] : [255, 255, 255];
    for (const layer of layers.reverse()) result = over(layer, result);
    return result;
  };

  // V002, V014: the page scrolls sideways as it is; V015: once the values of the items are
  // long, V018: a part that scrolls sideways (a table) grows then
  // the width of the layout viewport: a mobile browser widens its window to a wider page
  const root = document.documentElement;
  const width = root.clientWidth;
  const wide = () => root.scrollWidth > width + 1;
  const outside = (element: Element | null) => element !== null && element.getBoundingClientRect().right > width + 1;
  /** Whether an ancestor of the element clips it or scrolls it: the page does not grow with it. */
  const clipped = (element: Element) => {
    for (let node = element.parentElement; node !== null && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).overflowX !== 'visible') return true;
    }
    return false;
  };
  /**
   * The page as wide as it is, at the first element that sticks out of an element that does
   * not, else at the last one whose content sticks out of it (a text that does not wrap).
   */
  const sideways = (code: Code, how: string) => {
    const elements = [...document.body.querySelectorAll('*')].filter((it) => shown(it) && !clipped(it));
    const element =
      elements.find((it) => outside(it) && !outside(it.parentElement)) ??
      elements.reverse().find((it) => it.getBoundingClientRect().left + it.scrollWidth > width + 1);
    add(code, element ?? root, `The page is ${String(root.scrollWidth)} px wide at ${String(width)} px${how}.`);
  };
  if (wide()) {
    sideways(options.phone ? 'V002' : 'V014', '');
  } else {
    // the texts are long for a moment: this function runs at once, no render of the page comes between
    const long = `${'W'.repeat(40)} ${'and the words of a long value '.repeat(3)}`.slice(0, 120);
    const kept = new Map<Text, string>();
    // the texts of the items in their cells and fields (`data-text` of `FieldValue`), of any
    // length; not a date, a number or the label of a choice, short by their nature; not a form
    for (const element of document.querySelectorAll('[data-bz^="cell:"] [data-text], [data-bz^="field:"] [data-text]')) {
      if (element.closest('form, [aria-hidden="true"]')) continue;
      const texts = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = texts.nextNode(); node !== null; node = texts.nextNode()) {
        if (node instanceof Text && !kept.has(node) && node.data.trim()) kept.set(node, node.data);
      }
    }
    // the parts that scroll sideways (not the columns of a board) and fit their content
    const fitting = [...document.body.querySelectorAll('*')].filter((element) => {
      const overflow = getComputedStyle(element).overflowX;
      return (overflow === 'auto' || overflow === 'scroll') && shown(element) && !element.closest('[data-bz^="board:"]') && element.scrollWidth <= element.clientWidth + 1;
    });
    for (const node of kept.keys()) node.data = long;
    try {
      if (wide()) sideways('V015', ` with a text of ${String(long.length)} characters in the cells and the fields`);
      for (const element of fitting) {
        if (element.scrollWidth > element.clientWidth + 1) {
          add('V018', element, `It is ${String(element.scrollWidth)} px wide in ${String(element.clientWidth)} px with a text of ${String(long.length)} characters in the cells.`);
        }
      }
    } finally {
      for (const [node, data] of kept) node.data = data;
    }
  }

  // V003: a part that scrolls sideways at the width of a phone
  if (options.phone) {
    for (const element of document.body.querySelectorAll('*')) {
      // a board scrolls its columns
      if (element.closest('[data-bz^="board:"]')) continue;
      const overflow = getComputedStyle(element).overflowX;
      if ((overflow === 'auto' || overflow === 'scroll') && shown(element) && element.scrollWidth > element.clientWidth + 1) {
        add('V003', element, `It is ${String(element.scrollWidth)} px wide in ${String(element.clientWidth)} px.`);
      }
    }
  }

  // V004: the labels that show a raw name
  const RAW = /^(?=.*[a-z])[a-z0-9_]+$|^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+$/;
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const labels = '[data-bz^="list:"] th, [role="columnheader"], dt, label, legend, h1, h2, h3';
  for (const element of document.querySelectorAll(labels)) {
    const value = text(element);
    if (shown(element) && value && (RAW.test(value) || UUID.test(value))) {
      add('V004', element, `The label ${quote(value)} is a name, not a text for the users.`);
    }
  }

  // V005: a UUID anywhere on the screen; V006: the contrast of the texts
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const checked = new Set<Element>();
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const element = node.parentElement;
    const value = (node.textContent ?? '').trim();
    if (element === null || !value || checked.has(element) || !shown(element)) continue;
    if (element.closest('script, style, noscript, [aria-hidden="true"]')) continue;
    checked.add(element);
    const uuid = UUID.exec(value);
    if (uuid) add('V005', element, `It shows ${uuid[0]}.`);
    // a disabled control, and a text that only a screen reader reads (`sr-only`: 1×1 px)
    const box = element.getBoundingClientRect();
    if (element.closest(':disabled, [aria-disabled="true"]') || box.width < 2 || box.height < 2) continue;
    const style = getComputedStyle(element);
    const color = rgba(style.color);
    const behind = background(element);
    if (color === null || behind === null) continue;
    const fore = over(color, behind);
    const [light, dark] = [luminance(fore), luminance(behind)].sort((a, b) => b - a);
    const ratio = ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) {
      const rgb = (value: readonly number[]) => `rgb(${value.map((it) => String(Math.round(it))).join(', ')})`;
      add('V006', element, `The text ${quote(text(element))} has a contrast of ${ratio.toFixed(2)}:1 (${rgb(fore)} on ${rgb(behind)}).`);
    }
  }

  // V007: the light surfaces in the dark mode
  if (options.dark) {
    for (const element of document.body.querySelectorAll('*')) {
      if (element.closest('img, svg, video, canvas, picture, [data-bz^="map:"]')) continue;
      const color = rgba(getComputedStyle(element).backgroundColor);
      const box = element.getBoundingClientRect();
      if (color === null || color[3] < 0.5 || box.width < 40 || box.height < 40 || !shown(element)) continue;
      if (luminance(color) > 0.6) add('V007', element, `Its background ${getComputedStyle(element).backgroundColor} is light in the dark mode.`);
    }
  }

  // V008: the empty states
  const creates = options.creates.filter((id) => document.querySelector(`[data-bz="action:${id}"]`) !== null);
  for (const element of document.querySelectorAll('[data-bz="state:empty"]')) {
    if (!shown(element)) continue;
    if (!text(element)) add('V008', element, 'The empty state has no text.');
    else if (creates.length > 0 && element.querySelector('[data-bz^="action:"]') === null) {
      add('V008', element, `The empty state does not offer ${creates.map((id) => `action:${id}`).join(', ')}.`);
    }
  }

  // V016: the parts of the items that show none (their state loaded or empty, not an error);
  // a calendar shows its items as rows or as the counts of its days (the month of a phone)
  if (!options.searched) {
    const items = (element: Element) =>
      element.querySelector('[data-bz^="row:"]') !== null ||
      [...element.querySelectorAll('[data-bz^="day:"]')].some((day) => Number(day.getAttribute('data-count')) > 0);
    for (const element of document.querySelectorAll('[data-bz^="list:"], [data-bz^="board:"], [data-bz^="calendar:"], [data-bz^="recent:"]')) {
      if (!shown(element) || items(element)) continue;
      if (element.querySelector('[data-bz="state:loaded"], [data-bz="state:empty"]') === null) continue;
      add('V016', element, 'It shows no item: the data of the tests have none for it (a calendar: in the month of the day of the run).');
    }
  }

  // V009: the controls too small to touch on a phone, one issue for the screenshot (the
  // controls of a design system share their size: a list of each would hide the other codes)
  if (options.phone) {
    const controls =
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], ' +
      '[role="checkbox"], [role="switch"], [role="combobox"], [role="menuitem"]';
    const small: [Element, string][] = [];
    for (const element of document.querySelectorAll(controls)) {
      const box = target(element);
      // a link in a text, and what only a screen reader reads
      if (getComputedStyle(element).display === 'inline' || box.width < 2 || box.height < 2) continue;
      if (element.closest('[aria-hidden="true"]') || !shown(element)) continue;
      if (box.width < 44 || box.height < 44) {
        small.push([element, `${describe(element)} ${String(Math.round(box.width))}×${String(Math.round(box.height))}`]);
      }
    }
    const [first] = small;
    if (first) {
      const listed = small.slice(0, SMALL_LISTED).map(([, it]) => it).join(', ');
      const more = small.length > SMALL_LISTED ? `, and ${String(small.length - SMALL_LISTED)} more` : '';
      add('V009', first[0], `${String(small.length)} controls are smaller than 44×44 px: ${listed}${more}.`);
    }
  }

  /**
   * What a finger touches to use a control: its box, the `label` around it, or its
   * `::after` positioned over a larger area (a card that its title opens, the touch area of a
   * checkbox), whichever has the longest shortest side.
   */
  function target(element: Element): DOMRect {
    let best = element.getBoundingClientRect();
    const larger = (box: DOMRect) => {
      if (Math.min(box.width, box.height) > Math.min(best.width, best.height)) best = box;
    };
    const label = element.closest('label');
    if (label !== null) larger(label.getBoundingClientRect());
    const after = getComputedStyle(element, '::after');
    if (after.content !== 'none' && after.position === 'absolute') {
      let block: Element | null = element;
      while (block !== null && block !== document.body && getComputedStyle(block).position === 'static') block = block.parentElement;
      // its offsets are from the padding box of the block, inside its borders
      const container = block ?? document.body;
      const border = container.getBoundingClientRect();
      const inner = new DOMRect(border.left + container.clientLeft, border.top + container.clientTop, container.clientWidth, container.clientHeight);
      const px = (value: string) => parseFloat(value) || 0;
      const left = inner.left + px(after.left);
      const top = inner.top + px(after.top);
      larger(new DOMRect(left, top, inner.right - px(after.right) - left, inner.bottom - px(after.bottom) - top));
    }
    return best;
  }

  // V010: the texts cut without their whole text; V017: those cut to a few characters
  for (const element of document.body.querySelectorAll('*')) {
    const style = getComputedStyle(element);
    const ellipsis = style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1;
    const cut = ellipsis || (style.webkitLineClamp !== 'none' && style.webkitLineClamp !== '' && element.scrollHeight > element.clientHeight + 1);
    if (!cut || !shown(element)) continue;
    if (ellipsis && element.clientWidth < 4 * parseFloat(style.fontSize)) {
      add('V017', element, `The text ${quote(text(element))} is cut to ${String(element.clientWidth)} px.`);
    }
    if (element.closest('[title], [aria-describedby], [data-slot="tooltip-trigger"]')) continue;
    add('V010', element, `The text ${quote(text(element))} is cut.`);
  }

  return issues;
}
