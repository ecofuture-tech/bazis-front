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

// The input of a date (`2026-10-07`): of a date field in the forms (`FieldInput`) and of the
// date ranges of the filters of a list, `<input type="date">` of the browser, or the control
// that `DatesProvider` gives it below (the calendar of the component date-picker,
// `DatePickerProvider`).

import { createContext, use, useMemo, type ComponentProps, type ComponentType, type ReactNode } from 'react';

import { Input } from '@/components/ui/input';

/** The props of the input of a date: those of an `<input>`, its value a date or the empty string. */
export type DateInputProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  /** `2026-10-07`, or the empty string for none. */
  value: string;
  onChange: (value: string) => void;
  'data-bz'?: string | undefined;
};

/** The inputs of the dates below a `DatesProvider`. */
interface Dates {
  /** Their control; null: `<input type="date">`. */
  control: ComponentType<DateInputProps> | null;
}

const DatesContext = createContext<Dates>({ control: null });

/** Gives the inputs of the dates below it their control (`DatePickerProvider` of date-picker). */
export function DatesProvider({ control, children }: { control: ComponentType<DateInputProps> | null; children: ReactNode }) {
  const dates = useMemo(() => ({ control }), [control]);
  return <DatesContext value={dates}>{children}</DatesContext>;
}

/** The inputs of the dates: their control of `DatesProvider`. */
export function useDates(): Dates {
  return use(DatesContext);
}

/** The input of a date: the control of `DatesProvider`, else `<input type="date">`. */
export function DateInput(props: DateInputProps) {
  const Control = useDates().control;
  if (Control) return <Control {...props} />;
  const { onChange, ...rest } = props;
  return (
    <Input
      {...rest}
      type="date"
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
