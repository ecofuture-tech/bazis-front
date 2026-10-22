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

// The pickers of the related items of a relationship: a combobox over the list of the
// related resource (its path from `ROUTES` of the contract), read page after page and
// searched by the backend (`search`) when its route set has search fields (`search` of the
// resource in the contract): the core answers a search of a route set without them with 400.
// `RelationPicker` chooses the item of a to-one relationship, `RelationListPicker` the items
// of a to-many one.

import { Check, ChevronsUpDown, LoaderCircle, Search } from 'lucide-react';
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';

import { nextPage, type Filter } from '@/bazis/client';
import { useLanguage } from '@/bazis/i18n';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { titleFromText } from './field-value.js';
import { hasSearch, itemLabel, routeOf, type ResourceObject } from './fields.js';
import { useAnyList } from './hooks.js';
import { RelationLabel } from './relation.js';

/** How many items a page of the picker reads; `Load more` reads the next one. */
export const PICKER_PAGE = 20;
/** How many labels of its items the button of a picker shows; `+N` for the others, unread. */
const SHOWN_LABELS = 8;
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
  /**
   * Whether the route set searches (`search`): a search box over the items, else the items
   * without a search. By default whether the related resource has search fields in the
   * contract (`search` of `RESOURCES`).
   */
  searchable?: boolean | undefined;
  /**
   * The items it offers: those of the related resource that match it (`filter` of its list),
   * such as the users of a role, `Filter.where('roles__slug', 'master')`; all by default.
   */
  filter?: Filter | undefined;
  /** The id of the related item, null for none. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** The text of no item, and the label of the option that clears the value. */
  placeholder?: string;
  /** Whether the value may be cleared (an option with the placeholder): a nullable relationship. */
  nullable?: boolean;
  /** The name of the field, in the name of the search (`Search <label>`). */
  label?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  'aria-readonly'?: boolean | undefined;
  'data-bz'?: string;
}

const TRIGGER =
  'flex h-9 w-full min-w-0 items-center pointer-coarse:min-h-11 justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 ' +
  'text-left text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring ' +
  'focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30';

type Entry = { kind: 'clear' } | { kind: 'item'; item: ResourceObject } | { kind: 'more' };

interface OptionsProps {
  path: string;
  filter: Filter | undefined;
  /** The ids of the selected items. */
  selected: readonly string[];
  /** Several items are selected: a click toggles an item and keeps the list open. */
  multiple: boolean;
  /** An option that clears the value (with the placeholder). */
  clearable: boolean;
  placeholder: string;
  /** Whether the items are searched: a search box, else the list takes the keys. */
  searchable: boolean;
  /** The name of the search (of the list without one) for assistive technologies. */
  searchLabel: string;
  /** The list, which has the focus and the keys without a search. */
  listRef: RefObject<HTMLUListElement | null>;
  onSelect: (item: ResourceObject | null) => void;
  /** Closes the picker (Tab): the focus goes back to its button. */
  onClose: () => void;
}

/**
 * The search and the options of an open picker; without a search, the list takes the focus
 * and the keys (`aria-activedescendant` on the listbox). The items are read page after page
 * (`page[offset]`, `PICKER_PAGE` each: a larger `page[limit]` would pass the maximum of the
 * backend, `BAZIS_API_PAGINATION_PAGE_SIZE_MAX`). The active option (`aria-activedescendant`)
 * is, until the user moves, the (first) selected item when the picker opens and the first
 * item after a search, never the option that clears the value.
 */
function Options({
  path,
  filter,
  selected,
  multiple,
  clearable,
  placeholder,
  searchable,
  searchLabel,
  listRef,
  onSelect,
  onClose,
}: OptionsProps) {
  const listId = useId();
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  // the items of the pages before the last one, and the offset of the last one
  const [earlier, setEarlier] = useState<readonly ResourceObject[]>([]);
  const [offset, setOffset] = useState(0);
  // the option the user moved to; null: the default one
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = text.trim();
      if (next === search) return;
      setSearch(next);
      setEarlier([]);
      setOffset(0);
      setActive(null);
    }, SEARCH_DELAY);
    return () => {
      clearTimeout(timer);
    };
  }, [text, search]);

  const list = useAnyList(path, {
    ...(filter ? { filter } : {}),
    ...(search ? { search } : {}),
    page: offset ? { limit: PICKER_PAGE, offset } : { limit: PICKER_PAGE },
  });
  // the previous page (another search, another offset) is not this one
  const page = list.isPlaceholderData ? [] : (list.data?.data ?? []);
  const items = [...earlier, ...page];
  const next = list.data && !list.isPlaceholderData ? nextPage(list.data) : null;
  const entries: Entry[] = [
    ...(clearable ? [{ kind: 'clear' } as const] : []),
    ...items.map((item) => ({ kind: 'item', item }) as const),
    ...(next !== null ? [{ kind: 'more' } as const] : []),
  ];
  const first = clearable && items.length ? 1 : items.length ? 0 : -1;
  const initial = search ? -1 : entries.findIndex((entry) => entry.kind === 'item' && selected.includes(entry.item.id));
  const current = active === null ? (initial >= 0 ? initial : first) : Math.min(active, entries.length - 1);
  // the options shown are not those of the text typed yet
  const stale = list.isPending || list.isPlaceholderData || text.trim() !== search;
  const optionId = (index: number) => `${listId}-${String(index)}`;

  useEffect(() => {
    if (current >= 0) document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' });
  });

  function choose(entry: Entry) {
    if (entry.kind === 'item') onSelect(entry.item);
    else if (entry.kind === 'clear') onSelect(null);
    else if (next !== null) {
      setEarlier(items);
      setOffset(next.offset ?? offset + PICKER_PAGE);
    }
  }

  function keyDown(event: KeyboardEvent<HTMLElement>) {
    const count = entries.length;
    if (event.key === 'Tab') {
      event.preventDefault();
      onClose();
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && count) {
      event.preventDefault();
      const down = event.key === 'ArrowDown';
      setActive(current < 0 ? (down ? 0 : count - 1) : (current + (down ? 1 : count - 1)) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = entries[current];
      if (entry && !stale) choose(entry);
    }
  }

  let note = '';
  if (list.isPending || (list.isPlaceholderData && !earlier.length)) note = t('state.loading.title');
  else if (list.isError) note = t('picker.failed');
  else if (!items.length) note = t(search ? 'picker.no_match' : 'picker.empty');

  return (
    <div className="flex flex-col">
      {searchable && (
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 opacity-50" aria-hidden="true" />
          <input
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={current >= 0 ? optionId(current) : undefined}
            aria-label={searchLabel}
            placeholder={t('picker.search')}
            className="h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
            onKeyDown={keyDown}
          />
          {list.isFetching && <LoaderCircle className="size-4 shrink-0 animate-spin opacity-50" aria-hidden="true" />}
        </div>
      )}
      <ul
        role="listbox"
        id={listId}
        aria-label={searchLabel}
        aria-busy={list.isFetching || undefined}
        aria-multiselectable={multiple || undefined}
        // without a search the list has the focus (the first focusable of the popover) and the keys
        {...(searchable
          ? {}
          : {
              tabIndex: 0,
              'aria-activedescendant': current >= 0 ? optionId(current) : undefined,
              onKeyDown: keyDown,
            })}
        ref={listRef}
        // without a search the list stays shown while its first page loads: it has the focus
        className={cn('max-h-72 overflow-y-auto p-1 outline-none', searchable ? 'empty:hidden' : 'empty:p-0')}
      >
        {entries.map((entry, index) => {
          const chosen =
            entry.kind === 'item' ? selected.includes(entry.item.id) : entry.kind === 'clear' && !selected.length;
          return (
            <li
              key={entry.kind === 'item' ? entry.item.id : `$${entry.kind}`}
              id={optionId(index)}
              role="option"
              aria-selected={chosen}
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
                <span className="pl-6">{t('picker.more')}</span>
              ) : (
                <>
                  <Check className={cn('size-4 shrink-0', !chosen && 'invisible')} aria-hidden="true" />
                  <span ref={titleFromText} className="min-w-0 truncate">
                    {entry.kind === 'item' ? itemLabel(entry.item) : placeholder}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {/* announced: the state of the search */}
      <p role="status" aria-live="polite" className={note ? 'px-3 py-4 text-center text-sm text-muted-foreground' : 'sr-only'}>
        {note}
      </p>
    </div>
  );
}

function Picker({
  path,
  filter,
  relation,
  value,
  onChange,
  multiple,
  placeholder,
  clearable,
  searchable,
  disabled,
  required,
  className,
  label: name,
  ...control
}: Omit<RelationPickerProps, 'path' | 'placeholder' | 'nullable' | 'searchable' | 'value' | 'onChange'> & {
  path: string;
  /** The ids of the selected items (one at most without `multiple`). */
  value: readonly string[];
  onChange: (value: string[]) => void;
  multiple: boolean;
  placeholder: string;
  clearable: boolean;
  searchable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const { t } = useLanguage();
  // the items chosen here: their labels without another request
  const [chosen, setChosen] = useState<ReadonlyMap<string, ResourceObject>>(() => new Map());
  const more = value.length - SHOWN_LABELS;
  const label: ReactNode = value.length ? (
    <>
      {value.slice(0, SHOWN_LABELS).map((id, index) => {
        const item = chosen.get(id);
        return (
          <Fragment key={id}>
            {index > 0 && ', '}
            {item ? itemLabel(item) : <RelationLabel relation={relation} id={id} path={path} />}
          </Fragment>
        );
      })}
      {more > 0 && ` +${String(more)}`}
    </>
  ) : (
    placeholder
  );
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
          <span ref={titleFromText} className={cn('min-w-0 truncate', !value.length && 'text-muted-foreground')}>
            {label}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-60 p-0"
        // without a search the list takes the focus, also while it has no option yet
        {...(searchable
          ? {}
          : {
              onOpenAutoFocus: (event: Event) => {
                event.preventDefault();
                listRef.current?.focus();
              },
            })}
      >
        <Options
          path={path}
          filter={filter}
          selected={value}
          multiple={multiple}
          clearable={clearable}
          placeholder={placeholder}
          searchable={searchable}
          listRef={listRef}
          searchLabel={t(searchable ? 'picker.search_label' : 'picker.choose_label', {
            name: name ?? control['aria-label'] ?? relation,
          })}
          onSelect={(item) => {
            if (item === null) {
              onChange([]);
            } else {
              setChosen((current) => new Map(current).set(item.id, item));
              if (!multiple) onChange([item.id]);
              else onChange(value.includes(item.id) ? value.filter((id) => id !== item.id) : [...value, item.id]);
            }
            // several items are chosen one after the other: the list stays open
            if (!multiple) setOpen(false);
          }}
          onClose={() => {
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The picker of the related item of a to-one relationship: a button with the label of the
 * item (`role="combobox"`, the marks given to it) that opens the list of the related
 * resource, page after page, with a search when its route set searches (`searchable`) and
 * an option that clears the value when it is nullable (never the default option).
 * Keyboard (the combobox pattern of WAI-ARIA): Enter, Space or ArrowDown opens with the
 * selected item active, typing searches with the first item active, ArrowUp/ArrowDown
 * move, Enter selects (not while the options are those of another search), Escape and Tab
 * close and give the focus back to the button. The id in a text input when the contract
 * has no route for the related resource.
 */
export function RelationPicker({
  placeholder = '—',
  nullable = true,
  path,
  relation,
  searchable,
  filter,
  value,
  onChange,
  ...props
}: RelationPickerProps) {
  const route = path ?? routeOf(relation);
  if (route) {
    return (
      <Picker
        {...props}
        relation={relation}
        path={route}
        filter={filter}
        value={value === null ? [] : [value]}
        onChange={(ids) => {
          onChange(ids[0] ?? null);
        }}
        multiple={false}
        placeholder={placeholder}
        clearable={nullable}
        searchable={searchable ?? hasSearch(relation)}
      />
    );
  }
  const { required, 'aria-readonly': readOnly, label, ...control } = props;
  return (
    <Input
      {...control}
      aria-label={control['aria-label'] ?? label}
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

export interface RelationListPickerProps extends Omit<RelationPickerProps, 'value' | 'onChange' | 'nullable'> {
  /** The ids of the related items, in the order they were chosen. */
  value: readonly string[];
  onChange: (value: string[]) => void;
}

/**
 * The picker of the related items of a to-many relationship: a button with the labels of
 * the items (`role="combobox"`, the marks given to it) that opens the list of the related
 * resource (`aria-multiselectable`) as `RelationPicker` does (the labels of the first 8 items,
 * then `+N`, the others not read); a click or Enter adds or
 * removes an item and keeps the list open, the option with the placeholder
 * (`data-value=""`) removes them all, Escape and Tab close it. The ids in a text input,
 * separated by commas, when the contract has no route for the related resource.
 */
export function RelationListPicker({
  placeholder = '—',
  path,
  relation,
  searchable,
  filter,
  value,
  onChange,
  ...props
}: RelationListPickerProps) {
  const route = path ?? routeOf(relation);
  if (route) {
    return (
      <Picker
        {...props}
        relation={relation}
        path={route}
        filter={filter}
        value={value}
        onChange={onChange}
        multiple
        placeholder={placeholder}
        clearable
        searchable={searchable ?? hasSearch(relation)}
      />
    );
  }
  return <IdsInput {...props} value={value} onChange={onChange} placeholder={placeholder} />;
}

/** The ids of a to-many relationship in a text input, separated by commas, kept as typed. */
function IdsInput({
  value,
  onChange,
  required,
  'aria-readonly': readOnly,
  label,
  ...control
}: Omit<RelationListPickerProps, 'relation' | 'path' | 'searchable' | 'filter'> & { placeholder: string }) {
  const [draft, setDraft] = useState(() => value.join(', '));
  return (
    <Input
      {...control}
      aria-label={control['aria-label'] ?? label}
      value={draft}
      required={required}
      readOnly={readOnly}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(
          event.target.value
            .split(',')
            .map((it) => it.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}
