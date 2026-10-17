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

// The calendar of a date picker (react-day-picker, the npm dependency that
// `bazis_front add date-picker` sets in package.json, through the shadcn/ui component
// calendar), a chunk of its own loaded with the first calendar opened (`date-picker.tsx`): the
// month and the names of the days in the language of the interface (`Intl`, without the
// locales of date-fns), the weeks from its first day.

import { useLanguage, weekStart } from '@/bazis/i18n';
import { Calendar } from '@/components/ui/calendar';

type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The month of a date to pick one: the selected date marked, the keyboard on it. */
export default function CalendarView({ value, onSelect }: { value: Date | undefined; onSelect: (date: Date) => void }) {
  const { language, t } = useLanguage();
  const caption = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' });
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short' });
  const day = new Intl.DateTimeFormat(language, { dateStyle: 'full' });
  return (
    <Calendar
      mode="single"
      lang={language}
      selected={value}
      defaultMonth={value}
      // `Intl` counts from Monday (1 … 7), react-day-picker from Sunday (0 … 6)
      weekStartsOn={(weekStart(language) % 7) as WeekDay}
      formatters={{
        formatCaption: (month) => caption.format(month),
        formatWeekdayName: (date) => weekday.format(date),
      }}
      labels={{
        labelDayButton: (date) => day.format(date),
        labelNext: () => t('date.next_month'),
        labelPrevious: () => t('date.previous_month'),
      }}
      autoFocus
      onSelect={(date) => {
        if (date) onSelect(date);
      }}
    />
  );
}
