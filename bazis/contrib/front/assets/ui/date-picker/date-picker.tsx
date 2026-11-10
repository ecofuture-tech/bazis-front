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

// The input of a date with a calendar (`DatePickerProvider`: the dates of the forms and of
// the filters of the lists below it): a text in the numeric format of the language of the
// product (`02.11.2026`, `11/02/2026`: `controls.date: localized` of the theme, the default),
// or `<input type="date">` of the browser (`native`), marked as the input it replaces
// (`field:<name>`, `data-input="date"`: a scenario fills either with `2026-10-07`), and the
// month of the date in a popover (`calendar-view.tsx`, loaded with the first one opened), opened
// by a click on the field, the arrow down or the icon of the calendar.

import { CalendarDays } from 'lucide-react';
import { lazy, Suspense, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';

import { THEME, type Theme } from '@/bazis/generated/theme';
import { isoDate, useLanguage } from '@/bazis/i18n';
import { DatesProvider, type DateInputProps } from '@/bazis/ui/resource';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CalendarView = lazy(() => import('./calendar-view.js'));

/** A date of the backend (`2026-10-07`) as that day in the time zone of the browser. */
function dateOf(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

type Part = 'day' | 'month' | 'year';

const NUMERIC: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };

/** The letters of the placeholder of each part by the language (`дд.мм.гггг`); the English ones for another. */
const PLACEHOLDERS: Record<string, Record<Part, string>> = {
  ru: { day: 'дд', month: 'мм', year: 'гггг' },
  en: { day: 'dd', month: 'mm', year: 'yyyy' },
};

/** The parts of a numeric date of the language in their order, and what separates them (`dd.mm.yyyy`: `.`). */
function numericFormat(language: string): { order: Part[]; separator: string } {
  const parts = new Intl.DateTimeFormat(language, NUMERIC).formatToParts(new Date(2026, 10, 2));
  const order = parts.flatMap((part) => (part.type === 'day' || part.type === 'month' || part.type === 'year' ? [part.type] : []));
  const separator = parts.find((part) => part.type === 'literal')?.value ?? '.';
  return { order, separator };
}

/** A date of the backend as the numeric date of the language (`02.11.2026`); the text of another value. */
function shownDate(value: string, language: string): string {
  const date = dateOf(value);
  return date ? new Intl.DateTimeFormat(language, NUMERIC).format(date) : value;
}

/**
 * A date typed in the order of the parts of the language, separated by anything (`2.11.2026`,
 * `02/11/2026`), or as the backend writes it (`2026-11-02`): the date of the backend, null for
 * a text that is not a date.
 */
function typedDate(text: string, order: Part[]): string | null {
  const trimmed = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return dateOf(trimmed) ? trimmed : null;
  const numbers = trimmed.split(/\D+/).filter(Boolean).map(Number);
  if (numbers.length !== 3) return null;
  const parts = Object.fromEntries(order.map((part, index) => [part, numbers[index] ?? 0])) as Record<Part, number>;
  if (parts.year < 1000) return null;
  const date = dateOf(`${String(parts.year)}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`);
  return date ? isoDate(date) : null;
}

export type DatePickerProps = DateInputProps & {
  /** localized: a text in the numeric format of the language; native: `<input type="date">`. `controls.date` of the theme by default. */
  mode?: Theme['controls']['date'];
};

/**
 * The input of a date and its calendar, opened by a click on the field (the focus staying in it
 * to type), the arrow down or its icon: a text in the numeric format of the language of the
 * product (`02.11.2026`, whatever the language of the browser), typed in that order with any
 * separator or as `YYYY-MM-DD`, or `<input type="date">` of the browser (`mode: native`); no
 * calendar when the input is read-only. The month follows a date typed; a second arrow down goes
 * to the days, as a tap or the icon; a day picked, Escape or Tab closes it, the focus back in the
 * field.
 */
export function DatePicker({
  value,
  onChange,
  className,
  disabled,
  readOnly,
  onBlur,
  mode = THEME.controls.date,
  ...rest
}: DatePickerProps) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  // the month shown, and whether the days take the focus when it opens
  const [month, setMonth] = useState<Date>(() => new Date());
  const [toDays, setToDays] = useState(false);
  // the text being typed until the input is left: the date of the field otherwise
  const [draft, setDraft] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const days = useRef<HTMLDivElement>(null);
  // a tap opened the calendar: its touch does not focus the field (no keyboard)
  const tapped = useRef(false);
  const calendar = useId();
  const native = mode === 'native';
  const usable = !readOnly && !disabled;
  const { order, separator } = numericFormat(language);
  const letters = PLACEHOLDERS[language.split('-')[0] ?? ''] ?? PLACEHOLDERS.en;

  function show(focusDays: boolean) {
    if (!open) setMonth(dateOf(value) ?? new Date());
    setToDays(focusDays);
    setOpen(true);
  }

  const input: ComponentProps<'input'> = native
    ? {
        type: 'date',
        value,
        onChange: (event) => {
          onChange(event.target.value);
        },
        onBlur,
      }
    : {
        type: 'text',
        inputMode: 'numeric',
        autoComplete: 'off',
        placeholder: order.map((part) => letters?.[part]).join(separator),
        value: draft ?? shownDate(value, language),
        onChange: (event) => {
          const text = event.target.value;
          setDraft(text);
          const typed = text.trim() === '' ? '' : typedDate(text, order);
          if (typed !== null) onChange(typed);
          const date = typed ? dateOf(typed) : undefined;
          if (date) setMonth(date);
        },
        onBlur: (event) => {
          setDraft(null);
          onBlur?.(event);
        },
        ...(usable && {
          'aria-haspopup': 'dialog' as const,
          'aria-expanded': open,
          'aria-controls': open ? calendar : undefined,
          'data-state': open ? 'open' : 'closed',
          onPointerDown: (event) => {
            if (event.pointerType !== 'touch' && event.button === 0) show(false);
          },
          onPointerUp: (event) => {
            if (event.pointerType !== 'touch') return;
            tapped.current = true;
            show(true);
          },
          onTouchEnd: (event) => {
            if (!tapped.current) return;
            tapped.current = false;
            event.preventDefault();
          },
          onKeyDown: (event) => {
            if (event.key !== 'ArrowDown') return;
            event.preventDefault();
            if (!open) show(false);
            else days.current?.querySelector<HTMLElement>('[role="grid"] button[tabindex="0"]')?.focus();
          },
        }),
      };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={body} className={cn('relative flex min-w-0 items-center', className)}>
          <Input
            {...rest}
            {...input}
            ref={field}
            data-input="date"
            disabled={disabled}
            readOnly={readOnly}
            className={cn('w-full tabular-nums', !readOnly && 'pr-9', !readOnly && native && '[&::-webkit-calendar-picker-indicator]:hidden')}
          />
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              // the field is reached by Tab, the calendar from it
              tabIndex={native ? undefined : -1}
              disabled={disabled}
              aria-label={t('date.pick')}
              className="absolute right-0 text-muted-foreground"
              onClick={() => {
                if (open) setOpen(false);
                else show(true);
              }}
            >
              <CalendarDays aria-hidden="true" />
            </Button>
          )}
        </div>
      </PopoverAnchor>
      {!readOnly && (
        <PopoverContent
          ref={days}
          id={calendar}
          aria-label={t('date.pick')}
          align="end"
          className="w-auto p-0"
          // the days take the focus themselves (`toDays`), the field keeps it otherwise
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          // back to the field when the focus was in the calendar, closed
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (document.activeElement === document.body) field.current?.focus();
          }}
          // a click on the field or its icon while it is open is not one outside
          onInteractOutside={(event) => {
            if (event.target instanceof Node && body.current?.contains(event.target)) event.preventDefault();
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return;
            event.preventDefault();
            setOpen(false);
            field.current?.focus();
          }}
        >
          <Suspense fallback={<Skeleton data-bz="state:loading" aria-busy="true" className="m-3 h-72 w-64" />}>
            <CalendarView
              value={dateOf(value)}
              month={month}
              onMonthChange={setMonth}
              autoFocus={toDays}
              onSelect={(date) => {
                setDraft(null);
                onChange(isoDate(date));
                setOpen(false);
                field.current?.focus();
              }}
            />
          </Suspense>
        </PopoverContent>
      )}
    </Popover>
  );
}

/** The dates of the forms and of the filters below it are picked in a calendar (`DatePicker`). */
export function DatePickerProvider({ children }: { children: ReactNode }) {
  return <DatesProvider control={DatePicker}>{children}</DatesProvider>;
}
