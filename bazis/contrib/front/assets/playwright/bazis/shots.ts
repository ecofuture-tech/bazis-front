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

import { expect, type Page, type TestInfo } from '@playwright/test';

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
}

/** The result of a screenshot, `<screen>-<role>-<mode>-<width>.json` in the directory of the shots. */
export interface ShotResult {
  readonly screen: string;
  readonly role: string | null;
  readonly mode: 'light' | 'dark';
  readonly width: number;
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

/**
 * Opens a screen as the test user of the role (the screen of an item through the first item of
 * `via`, in its part), waits until nothing loads, checks what it renders (`check`) and takes a
 * screenshot of the whole page; writes the screenshot and its result into the directory of the
 * shots (`shotsDir`). A screen that cannot be reached is the issue V001 of its result, and
 * fails the test.
 */
export async function shoot<P extends Product>(page: Page, product: P, shot: Shot<P>, info: TestInfo): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  const name = [shot.screen, shot.role ?? 'nobody', shot.mode, String(width)].join('-');
  const directory = shotsDir(info);
  mkdirSync(directory, { recursive: true });
  const write = (result: ShotResult) => {
    writeFileSync(path.join(directory, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);
  };
  const base = { screen: shot.screen, role: shot.role, mode: shot.mode, width };
  try {
    await reach(page, product, shot);
    const issues = await check(page, { phone: width <= PHONE, dark: shot.mode === 'dark', creates: shot.creates });
    await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
    write({ ...base, file: `${name}.png`, issues });
  } catch (error) {
    // the message of Playwright without its colors, on one line
    const text = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-control-regex
    const message = text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim().slice(0, 400);
    write({ ...base, file: null, issues: [{ code: 'V001', severity: CODES.V001[0], selector: bz('screen', shot.screen), message }] });
    throw error;
  }
}

/** Opens the screen of a shot and waits until it has rendered a state and nothing loads. */
async function reach<P extends Product>(page: Page, product: P, shot: Shot<P>): Promise<void> {
  let app: App<P>;
  if (shot.role === null) {
    await stubForeignImages(page);
    app = new App(page, product);
  } else {
    app = await loginAs(page, product, shot.role);
  }
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
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** What `check` checks: the width of a phone, the dark mode, the actions that create an item. */
export interface CheckOptions {
  readonly phone: boolean;
  readonly dark: boolean;
  readonly creates: readonly string[];
}

/**
 * The issues of what the page renders (the codes of `CODES`, V002 to V010), at most
 * `MAX_ISSUES` of each code.
 */
export async function check(page: Page, options: CheckOptions): Promise<ShotIssue[]> {
  const found = await page.evaluate(audit, { ...options, max: MAX_ISSUES });
  return found.map((it) => ({ ...it, severity: CODES[it.code][0] }));
}

type Found = Omit<ShotIssue, 'severity'>;

/**
 * The checks, run in the page: self-contained, as `page.evaluate` sends its source. The colors
 * are those that the browser computes, converted to sRGB by a canvas (a token may be `oklch`).
 */
function audit(options: CheckOptions & { max: number }): Found[] {
  /** The small controls named in the one issue V009 of a screenshot. */
  const SMALL_LISTED = 5;
  const issues: Found[] = [];
  const counts = new Map<Code, number>();
  const add = (code: Code, element: Element, message: string) => {
    const count = (counts.get(code) ?? 0) + 1;
    counts.set(code, count);
    if (count <= options.max) issues.push({ code, selector: describe(element), message });
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

  // V002, V003: what scrolls sideways at the width of a phone
  if (options.phone) {
    const root = document.documentElement;
    if (root.scrollWidth > window.innerWidth + 1) {
      const wide = [...document.body.querySelectorAll('*')].find(
        (element) => shown(element) && element.getBoundingClientRect().right > window.innerWidth + 1,
      );
      add('V002', wide ?? root, `The page is ${String(root.scrollWidth)} px wide at ${String(window.innerWidth)} px.`);
    }
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
   * checkbox), whichever is the largest.
   */
  function target(element: Element): DOMRect {
    let best = element.getBoundingClientRect();
    const larger = (box: DOMRect) => {
      if (box.width * box.height > best.width * best.height) best = box;
    };
    const label = element.closest('label');
    if (label !== null) larger(label.getBoundingClientRect());
    const after = getComputedStyle(element, '::after');
    if (after.content !== 'none' && after.position === 'absolute') {
      let block: Element | null = element;
      while (block !== null && block !== document.body && getComputedStyle(block).position === 'static') block = block.parentElement;
      const around = (block ?? document.body).getBoundingClientRect();
      const px = (value: string) => parseFloat(value) || 0;
      const left = around.left + px(after.left);
      const top = around.top + px(after.top);
      larger(new DOMRect(left, top, around.right - px(after.right) - left, around.bottom - px(after.bottom) - top));
    }
    return best;
  }

  // V010: the texts cut without their whole text
  for (const element of document.body.querySelectorAll('*')) {
    const style = getComputedStyle(element);
    const cut =
      (style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1) ||
      (style.webkitLineClamp !== 'none' && style.webkitLineClamp !== '' && element.scrollHeight > element.clientHeight + 1);
    if (!cut || !shown(element)) continue;
    if (element.closest('[title], [aria-describedby], [data-slot="tooltip-trigger"]')) continue;
    add('V010', element, `The text ${quote(text(element))} is cut.`);
  }

  for (const [code, count] of counts) {
    if (count > options.max) {
      const last = issues.filter((it) => it.code === code).at(-1);
      if (last) issues[issues.indexOf(last)] = { ...last, message: `${last.message} (and ${String(count - options.max)} more)` };
    }
  }
  return issues;
}
