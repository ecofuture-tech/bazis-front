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

import type { KeyboardEvent, ReactNode } from 'react';

import type { Tone } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import {
  FieldValue,
  fieldValue,
  StatusLabel,
  statusyModel,
  type FieldDisplay,
  type Fields,
  type ResourceObject,
} from '@/bazis/ui/resource';
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
}

/** The content of a cell: that of `cells`, the badge of a status, else the formatted value. */
export function cell(props: BodyProps, row: ResourceObject, name: string): ReactNode {
  const custom = props.cells[name];
  if (custom) return custom(row);
  const field = props.fields.fields.get(name);
  const value = fieldValue(row, name);
  if (field?.kind === 'relation' && name === 'status' && typeof value === 'string' && statusyModel(row.type)) {
    return <StatusLabel type={row.type} status={value} />;
  }
  return <FieldValue field={field} value={value} type={row.type} display={props.display[name]} />;
}

export const FOCUS = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset';

/** The props of a row that opens its item, by a click or Enter. */
export function opener(id: string, onOpen: ((id: string) => void) | undefined) {
  if (!onOpen) return {};
  return {
    tabIndex: 0,
    onClick: () => {
      onOpen(id);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      // not the Enter of a control of the row (its actions), which bubbles
      if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(id);
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
