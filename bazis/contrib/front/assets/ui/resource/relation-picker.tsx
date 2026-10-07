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

// The picker of the related item of a to-one relationship: a combobox over the list of the
// related resource (its path from `ROUTES` of the contract), searched by the backend
// (`search`) and read page after page.

import { Check, ChevronsUpDown, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useId, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';

import { nextPage } from '@/bazis/client';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { itemLabel, routeOf, type ResourceObject } from './fields.js';
import { useAnyList } from './hooks.js';
import { RelationLabel } from './relation.js';

/** How many items a page of the picker reads; `Load more` reads the next one. */
export const PICKER_PAGE = 20;
const SEARCH_DELAY = 250;

export interface RelationPickerProps
  extends Pick<
    ComponentProps<'button'>,
    'id' | 'className' | 'aria-invalid' | 'aria-describedby' | 'aria-label'
  > {
  /** The JSON:API type of the related resource. */
  relation: string;
  /** The route set of the related resource, instead of its route in `ROUTES` of the contract. */
  path?: string | undefined;
  /** The id of the related item, null for none. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** The text of no item, and the label of the option that clears the value. */
  placeholder?: string;
  /** Whether the value may be cleared (an option with the placeholder): a nullable relationship. */
  nullable?: boolean;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  'aria-readonly'?: boolean | undefined;
  'data-bz'?: string;
}

const TRIGGER =
  'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 ' +
  'text-left text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring ' +
  'focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30';

type Entry = { kind: 'clear' } | { kind: 'item'; item: ResourceObject } | { kind: 'more' };

interface OptionsProps {
  path: string;
  value: string | null;
  nullable: boolean;
  placeholder: string;
  onSelect: (item: ResourceObject | null) => void;
}

/** The search and the options of an open picker. */
function Options({ path, value, nullable, placeholder, onSelect }: OptionsProps) {
  const listId = useId();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [pages, setPages] = useState(1);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(text.trim());
      setPages(1);
      setActive(0);
    }, SEARCH_DELAY);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);

  const list = useAnyList(path, { ...(search ? { search } : {}), page: { limit: PICKER_PAGE * pages } });
  const items = list.data?.data ?? [];
  const entries: Entry[] = [
    ...(nullable ? [{ kind: 'clear' } as const] : []),
    ...items.map((item) => ({ kind: 'item', item }) as const),
    ...(list.data && nextPage(list.data) !== null ? [{ kind: 'more' } as const] : []),
  ];
  const current = Math.min(active, entries.length - 1);
  const optionId = (index: number) => `${listId}-${String(index)}`;

  useEffect(() => {
    if (current >= 0) document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' });
  });

  function choose(entry: Entry) {
    if (entry.kind === 'more') setPages(pages + 1);
    else onSelect(entry.kind === 'item' ? entry.item : null);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = entries.length;
    if (!count) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = entries[current];
      if (entry) choose(entry);
    }
  }

  let note: ReactNode = null;
  if (list.isPending) note = 'Loading…';
  else if (list.isError) note = 'The items could not be loaded.';
  else if (!items.length) note = search ? 'Nothing matches the search.' : 'There are no items.';

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        <input
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? optionId(current) : undefined}
          aria-label="Search"
          placeholder="Search…"
          className="h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={keyDown}
        />
        {list.isFetching && <LoaderCircle className="size-4 shrink-0 animate-spin opacity-50" aria-hidden="true" />}
      </div>
      <ul
        role="listbox"
        id={listId}
        aria-label="Items"
        aria-busy={list.isFetching || undefined}
        className="max-h-72 overflow-y-auto p-1 empty:hidden"
      >
        {entries.map((entry, index) => {
          const selected = entry.kind === 'item' ? entry.item.id === value : entry.kind === 'clear' && value === null;
          return (
            <li
              key={entry.kind === 'item' ? entry.item.id : `$${entry.kind}`}
              id={optionId(index)}
              role="option"
              aria-selected={selected}
              data-value={entry.kind === 'item' ? entry.item.id : entry.kind === 'clear' ? '' : undefined}
              data-active={index === current || undefined}
              className={cn(
                'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none',
                'data-[active]:bg-accent data-[active]:text-accent-foreground',
                entry.kind !== 'item' && 'text-muted-foreground',
              )}
              // the search keeps the focus
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onMouseMove={() => {
                if (index !== current) setActive(index);
              }}
              onClick={() => {
                choose(entry);
              }}
            >
              {entry.kind === 'more' ? (
                <span className="pl-6">Load more</span>
              ) : (
                <>
                  <Check className={cn('size-4 shrink-0', !selected && 'invisible')} aria-hidden="true" />
                  <span className="min-w-0 truncate">{entry.kind === 'item' ? itemLabel(entry.item) : placeholder}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {note !== null && <p className="px-3 py-4 text-center text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}

function Picker({
  path,
  relation,
  value,
  onChange,
  placeholder,
  nullable,
  disabled,
  required,
  className,
  ...control
}: Omit<RelationPickerProps, 'path' | 'placeholder' | 'nullable'> & { path: string; placeholder: string; nullable: boolean }) {
  const [open, setOpen] = useState(false);
  // the item chosen here: its label without another request
  const [chosen, setChosen] = useState<ResourceObject | null>(null);
  let label: ReactNode = placeholder;
  if (value !== null) {
    label = chosen?.id === value ? itemLabel(chosen) : <RelationLabel relation={relation} id={value} path={path} />;
  }
  return (
    // modal: the list scrolls and takes the focus inside a dialog (a form, the payload of a transit)
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          {...control}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-required={required || undefined}
          disabled={disabled}
          className={cn(TRIGGER, className)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && !open) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span className={cn('min-w-0 truncate', value === null && 'text-muted-foreground')}>{label}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-60 p-0">
        <Options
          path={path}
          value={value}
          nullable={nullable}
          placeholder={placeholder}
          onSelect={(item) => {
            setChosen(item);
            onChange(item === null ? null : item.id);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The picker of the related item of a to-one relationship: a button with the label of the
 * item (`role="combobox"`, the marks given to it) that opens a search over the list of the
 * related resource, page after page, with an option that clears the value when it is
 * nullable; keyboard: Enter, Space or ArrowDown opens, ArrowUp/ArrowDown choose, Enter
 * selects, Escape closes. The id in a text input when the contract has no route for the
 * related resource.
 */
export function RelationPicker({ placeholder = '—', nullable = true, path, relation, ...props }: RelationPickerProps) {
  const route = path ?? routeOf(relation);
  if (route) return <Picker {...props} relation={relation} path={route} placeholder={placeholder} nullable={nullable} />;
  const { value, onChange, required, 'aria-readonly': readOnly, ...control } = props;
  return (
    <Input
      {...control}
      value={value ?? ''}
      placeholder={placeholder}
      required={required}
      readOnly={readOnly}
      onChange={(event) => {
        onChange(event.target.value || null);
      }}
    />
  );
}
