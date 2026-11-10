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

// The rows of a list, shown by its table and by its cards alike: what they are given, the
// content of a cell (the status of an item of a statusy model as a badge of its tone), a row
// that opens its item, and the checkboxes that select a row, `select:<id>`, and the rows of
// the page, `select:all`.

import type { ComponentType, KeyboardEvent, ReactNode } from 'react';

import type { Tone } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import { itemName, ItemValue, type FieldDisplay, type Fields, type ResourceObject } from '@/bazis/ui/resource';
import { Checkbox } from '@/components/ui/checkbox';

export interface BodyProps {
  rows: readonly ResourceObject[];
  columns: readonly string[];
  fields: Fields;
  cells: Readonly<Record<string, (row: ResourceObject) => ReactNode>>;
  display: Readonly<Record<string, FieldDisplay>>;
  onOpen: ((id: string) => void) | undefined;
  selected: string | undefined;
  rowActions: (row: ResourceObject) => ReactNode;
  rowTone: (row: ResourceObject) => Tone | undefined;
  rowToneLabel: (row: ResourceObject) => string | undefined;
  /** Whether a column is hidden: its cells stay, for the scenarios that look a row up by them. */
  hidden: (name: string) => boolean;
  /** The ids of the selected rows; undefined when the rows are not selectable. */
  selection: ReadonlySet<string> | undefined;
  /** Selects rows, or clears them. */
  onSelect: (ids: readonly string[], selected: boolean) => void;
  /** The composition of a card of the grid; without it, the first column is the title, the first column of an image beside it. */
  card: CardLayout | undefined;
  /** The icon of the entity: the cover of a card without its image. */
  icon: ComponentType<{ className?: string }> | undefined;
}

/**
 * The composition of a card of a grid (`list.card` of the spec), each role a column (a role whose
 * column is not shown is left out), each value without its label but those of `meta`; the other
 * columns are pairs of a label and a value.
 */
export interface CardLayout {
  /** The cover, the whole width of the card: a column of an image (`display: 'image'`); the first one by default. */
  media?: string;
  /** A rubric above the title. */
  eyebrow?: string;
  /** The title; the first column without a role by default. */
  title?: string;
  /** The main value, in the heading font. */
  figure?: string;
  /** Values in a muted line, each after its label (`Deposit 10,000 ₽`). */
  meta?: readonly string[];
}

/** The content of a cell: that of `cells`, the badge of a status, else the formatted value (`media`: as the cover of a card). */
export function cell(props: BodyProps, row: ResourceObject, name: string, media = false): ReactNode {
  const custom = props.cells[name];
  if (custom) return custom(row);
  return <ItemValue item={row} name={name} fields={props.fields} display={props.display[name]} media={media} />;
}

// the focus of a row: the ring of 0.12 inside it, not `ring-focus`, which is outside the element
// and which the area of the table, scrolling, cuts off (a shadow of the token cannot be inset)
export const FOCUS = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset';

/** The props of a row that opens its item, by a click, Enter or Space, named by the name of its item. */
export function opener(row: ResourceObject, onOpen: ((id: string) => void) | undefined) {
  if (!onOpen) return {};
  return {
    tabIndex: 0,
    'aria-label': itemName(row) ?? undefined,
    onClick: () => {
      onOpen(row.id);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      // not the key of a control of the row (its actions), which bubbles
      if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
        // Space opens it, never scrolls the page
        event.preventDefault();
        onOpen(row.id);
      }
    },
  };
}

/** The checkbox that selects a row, `select:<id>`; it does not open the row. */
export function RowCheckbox({ id, selection, onSelect }: { id: string; selection: ReadonlySet<string>; onSelect: BodyProps['onSelect'] }) {
  const { t } = useLanguage();
  return (
    <Checkbox
      data-bz={`select:${id}`}
      aria-label={t('list.select_row')}
      checked={selection.has(id)}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onCheckedChange={(checked) => {
        onSelect([id], checked === true);
      }}
    />
  );
}

/** The checkbox that selects the rows of the page, `select:all`: in the header of the table, above the cards. */
export function PageCheckbox({ rows, selection, onSelect }: Pick<BodyProps, 'rows' | 'onSelect'> & { selection: ReadonlySet<string> }) {
  const { t } = useLanguage();
  const count = rows.filter((row) => selection.has(row.id)).length;
  return (
    <Checkbox
      data-bz="select:all"
      aria-label={t('list.select_all')}
      checked={count > 0 && count === rows.length ? true : count > 0 ? 'indeterminate' : false}
      onCheckedChange={(checked) => {
        onSelect(
          rows.map((row) => row.id),
          checked === true,
        );
      }}
    />
  );
}
