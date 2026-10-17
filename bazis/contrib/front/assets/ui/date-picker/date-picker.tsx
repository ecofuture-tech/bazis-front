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
// the filters of the lists below it): `<input type="date">` of the browser, marked as the
// input it replaces (`field:<name>`: a scenario fills it with `2026-10-07`), and a button
// that opens the month of the date in a popover (`calendar-view.tsx`, loaded with the first
// one opened).

import { CalendarDays } from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';

import { isoDate, useLanguage } from '@/bazis/i18n';
import { DatesProvider, type DateInputProps } from '@/bazis/ui/resource';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CalendarView = lazy(() => import('./calendar-view.js'));

/** A date of the backend (`2026-10-07`) as that day in the time zone of the browser. */
function dateOf(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

/**
 * The input of a date and its calendar: the button of the calendar in the input (the picker
 * of the browser hidden where it can be), none when the input is read-only.
 */
export function DatePicker({ value, onChange, className, disabled, readOnly, ...rest }: DateInputProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('relative flex min-w-0 items-center', className)}>
      <Input
        {...rest}
        type="date"
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        className={cn('w-full', !readOnly && 'pr-10 [&::-webkit-calendar-picker-indicator]:hidden')}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {!readOnly && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label={t('date.pick')}
              className="absolute right-0.5 text-muted-foreground"
            >
              <CalendarDays aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Suspense fallback={<Skeleton aria-busy="true" className="m-3 h-72 w-64" />}>
              <CalendarView
                value={dateOf(value)}
                onSelect={(date) => {
                  onChange(isoDate(date));
                  setOpen(false);
                }}
              />
            </Suspense>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/** The dates of the forms and of the filters below it are picked in a calendar (`DatePicker`). */
export function DatePickerProvider({ children }: { children: ReactNode }) {
  return <DatesProvider control={DatePicker}>{children}</DatesProvider>;
}
