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

import { Fragment, type ReactNode } from 'react';

import { useLanguage } from '@/bazis/i18n';
import type { FormField } from '@/bazis/react';
import { cn } from '@/lib/utils';

import { fieldValue, formatValue, statusName, statusyModel, type FieldDisplay, type Fields, type ResourceObject } from './fields.js';
import { FileValue, isFile, useFiles } from './files.js';
import { text } from './hooks.js';
import { RelationLabel } from './relation.js';
import { StatusLabel } from './status.js';

export interface FieldValueProps {
  field: FormField | undefined;
  value: unknown;
  /** The JSON:API type of the item: the `status` of an item of a statusy model is named by the contract. */
  type?: string;
  /** How the value is shown (`display` of the field of the entity of the specs). */
  display?: FieldDisplay | undefined;
  /** The value is that of a card: the thumbnail of an image (`display: 'image'`) is large. */
  large?: boolean | undefined;
  /** The image (`display: 'image'`) is the cover of a card of a grid: its whole width, the first of several files. */
  media?: boolean | undefined;
  /** Chips before `+<n>`: 2, all if `large`. */
  chips?: number | undefined;
}

/** The tints of the avatars (`--avatar-<n>` of the theme), the same for the same name. */
const AVATARS = [
  'bg-avatar-0 text-avatar-0-fg',
  'bg-avatar-1 text-avatar-1-fg',
  'bg-avatar-2 text-avatar-2-fg',
  'bg-avatar-3 text-avatar-3-fg',
  'bg-avatar-4 text-avatar-4-fg',
];

/** The initials of a name: the first letters of its first two words, its parentheses left out. */
function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, ' ').trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

/**
 * A name after the circle of its initials, in a tint chosen by the name. The initials are drawn
 * by CSS: the text of the value is the name alone, for its title and the scenarios.
 */
function Avatar({ name }: { name: string }) {
  // FNV-1a: its low digits mix every letter (a multiplier of 31 leaves the remainder by 5 the sum of the letters)
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index += 1) hash = Math.imul(hash ^ name.charCodeAt(index), 16777619) >>> 0;
  const hue = hash % AVATARS.length;
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2.5 align-middle">
      <span
        aria-hidden="true"
        data-initials={initials(name) || '?'}
        className={cn(
          'inline-flex size-7.5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold tracking-[0.02em] before:content-[attr(data-initials)]',
          AVATARS[hue],
        )}
      />
      <span data-text="" className="min-w-0">
        {name}
      </span>
    </span>
  );
}

/** A part of a text as a chip: its quantity after `×` in bold (`Tent ×2`). */
function ChipText({ part }: { part: string }) {
  const match = /^(.*?)\s*(×\s*\d+)$/.exec(part);
  if (!match) return <>{part}</>;
  return (
    <>
      {match[1]} <b className="font-semibold text-foreground">{match[2]}</b>
    </>
  );
}

/**
 * The parts of a value as chips, the first `limit` of them (each cut to the width of the value
 * with its text in its title), and `+<n>` of the others (their text its title). The commas
 * between them are for the readers of the screen: the text of the value is that of the list
 * (`Tent ×2, Stove ×1`, the labels of the related items), for its title and the scenarios.
 */
function Chips({ parts, limit }: { parts: readonly { key: string; content: ReactNode }[]; limit: number }) {
  const shown = parts.slice(0, limit);
  const rest = parts.slice(limit);
  return (
    // inline: the chips wrap as words (in a value of a card cut to one line too), aligned as the text
    // around them; relative: the separators for the readers of the screen stay in it, never out of
    // the scroll of a table
    <span data-slot="chips" className="relative -my-0.5 inline-block max-w-full align-middle whitespace-normal">
      {shown.map((part, index) => (
        <Fragment key={part.key}>
          {index > 0 && <span className="sr-only">, </span>}
          <span
            ref={titleFromText}
            data-text=""
            className="my-0.5 inline-block h-6 max-w-full truncate rounded-md bg-neutral-soft px-2 align-middle text-[0.8125rem] leading-6 font-normal text-neutral-ink not-last:me-1.5"
          >
            {part.content}
          </span>
        </Fragment>
      ))}
      {rest.length > 0 && (
        <>
          <span className="sr-only">, </span>
          <span
            ref={titleFromText}
            data-more={`+${String(rest.length)}`}
            className="inline-block px-0.5 align-middle text-[0.8125rem] font-medium text-muted-foreground tabular-nums before:content-[attr(data-more)]"
          >
            <span className="sr-only">
              {rest.map((part, index) => (
                <Fragment key={part.key}>
                  {index > 0 && ', '}
                  {part.content}
                </Fragment>
              ))}
            </span>
          </span>
        </>
      )}
    </span>
  );
}

/** A number with a bar of its share of `max` (`display: {bar}`), a `meter`. */
function Bar({ value, max, text, label }: { value: number; max: number; text: string; label: string }) {
  const share = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;
  return (
    <span className="inline-flex items-center gap-2">
      {text}
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(Math.max(value, 0), Math.max(max, 0))}
        aria-valuetext={text}
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${String(share)}%` }} />
      </span>
    </span>
  );
}

/**
 * The value of a field for reading: an attribute formatted by its type, its format and
 * `display` (a phone as a link to call it, a share as a bar, `per` muted after a sum),
 * the labels of the related items of a relationship (the status of an item of
 * bazis-statusy by its name), the uploaded files
 * (`FileValue`; their thumbnails only with `display: 'image'`, large in a card, the cover of a
 * card of a grid as `media`). A text of the item, of any length (a string without a choice or a format, the
 * label of a related item), is in an element `data-text`, which the screenshots make long to
 * check the layout (V015), unlike a date, a number or the label of a choice.
 */
export function FieldValue({ field, value, type, display, large = false, media = false, chips = large ? Infinity : 2 }: FieldValueProps) {
  const { resources } = useFiles();
  const language = useLanguage();
  if (isFile(field, resources) && value !== null && value !== undefined) {
    const thumbnail = display === 'image' ? (media ? 'cover' : large ? 'large' : 'small') : undefined;
    if (!Array.isArray(value)) return <FileValue relation={field.relation} id={text(value)} thumbnail={thumbnail} />;
    const ids = (value as unknown[]).map(text);
    if (!ids.length) return <>—</>;
    if (thumbnail === 'cover') return <FileValue relation={field.relation} id={ids[0] ?? ''} thumbnail={thumbnail} />;
    return (
      <span className={thumbnail ? 'inline-flex flex-wrap gap-2' : 'inline-flex flex-wrap gap-x-3 gap-y-1'}>
        {ids.map((id) => (
          <FileValue key={id} relation={field.relation} id={id} thumbnail={thumbnail} />
        ))}
      </span>
    );
  }
  if (field?.kind === 'relation' && field.name === 'status' && typeof value === 'string' && type && statusyModel(type)) {
    return <>{statusName(type, value, language.language)}</>;
  }
  if (field?.kind === 'relation' && value !== null && value !== undefined) {
    const ids = Array.isArray(value) ? (value as unknown[]).map(text) : [text(value)];
    if (!ids.length) return <>—</>;
    if (display === 'chips') {
      return <Chips limit={chips} parts={ids.map((id) => ({ key: id, content: <RelationLabel relation={field.relation} id={id} /> }))} />;
    }
    return (
      <>
        {ids.map((id, index) => (
          <span key={id} data-text="">
            {index > 0 && ', '}
            <RelationLabel relation={field.relation} id={id} />
          </span>
        ))}
      </>
    );
  }
  if (typeof display === 'object' && 'currency' in display && display.per !== undefined && (typeof value === 'number' || (typeof value === 'string' && value !== ''))) {
    // what the sum is for (`/ сутки`), smaller and muted after it, in the font of the text
    const { per, ...sum } = display;
    return (
      <>
        {formatValue(field, value, language, sum)}
        <span data-slot="per" className="font-sans text-[0.8125rem] font-medium tracking-normal text-muted-foreground">
          {` / ${language.t(per)}`}
        </span>
      </>
    );
  }
  const shown = formatValue(field, value, language, display);
  // of the text shown: a choice by its label
  if (display === 'avatar' && typeof value === 'string' && value.trim()) return <Avatar name={shown} />;
  if (display === 'chips' && typeof value === 'string' && value.trim()) {
    const parts = shown.split(/\s*,\s*/).filter(Boolean);
    return <Chips limit={chips} parts={parts.map((part, index) => ({ key: String(index), content: <ChipText part={part} /> }))} />;
  }
  if (display === 'phone' && typeof value === 'string' && /\d/.test(value)) {
    return (
      <a
        href={`tel:${value.replace(/[^\d+]/g, '')}`}
        className="text-primary underline-offset-4 hover:underline"
        // a call, not the opening of the row
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {shown}
      </a>
    );
  }
  if (typeof display === 'object' && 'bar' in display && typeof value === 'number') {
    return <Bar value={value} max={display.bar} text={shown} label={field?.title ?? shown} />;
  }
  const free = typeof value === 'string' && shown === value && !(field?.kind === 'attribute' && field.format);
  return free ? <span data-text="">{shown}</span> : <>{shown}</>;
}

export interface ItemValueProps {
  item: ResourceObject;
  /** The name of the field. */
  name: string;
  /** The fields of the item's route set (`useListFields`, `useItemFields`). */
  fields: Fields;
  display?: FieldDisplay | undefined;
  /** The image is the cover of a card of a grid (`FieldValue` `media`). */
  media?: boolean | undefined;
  chips?: number | undefined;
}

/**
 * A ref that gives an element its text as its title, kept as the text changes (the label of a
 * related item read later): the whole text of a value that `truncate` may cut.
 */
export function titleFromText(element: HTMLElement | null): (() => void) | undefined {
  if (element === null) return undefined;
  const update = () => {
    const value = element.textContent.replace(/\s+/g, ' ').trim();
    if (value) element.title = value;
    else element.removeAttribute('title');
  };
  update();
  const observer = new MutationObserver(update);
  observer.observe(element, { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
  };
}

/**
 * The value of a field of an item as a cell shows it: the status of an item of a statusy model
 * as a badge of its tone (`status:<id>`), any other field as `FieldValue`.
 */
export function ItemValue({ item, name, fields, display, media, chips }: ItemValueProps) {
  const field = fields.fields.get(name);
  const value = fieldValue(item, name);
  if (field?.kind === 'relation' && name === 'status' && typeof value === 'string' && statusyModel(item.type)) {
    return <StatusLabel type={item.type} status={value} />;
  }
  return <FieldValue field={field} value={value} type={item.type} display={display} media={media} chips={chips} />;
}
