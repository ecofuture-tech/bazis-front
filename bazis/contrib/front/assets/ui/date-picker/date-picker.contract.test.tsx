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

// The contract of the date picker: the input of a date stays `<input type="date">` with the
// marks of the input it replaces (`field:<name>`, filled with `2026-10-07`), and its button
// opens the month of the date, whose days give the date picked: every input of a date below
// `DatePickerProvider` (the forms, the filters of the lists). Keep it passing when the
// component is changed.

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/bazis/i18n';
import type { FormField } from '@/bazis/react';
import { DatePicker, DatePickerProvider } from '@/bazis/ui/date-picker';
import { FieldInput } from '@/bazis/ui/resource';
import { testLanguages } from '@/bazis/ui/testing';

const due = {
  kind: 'attribute', name: 'due', title: 'Due', type: 'string', format: 'date', enum: null, labels: null,
  required: false, readOnly: false, nullable: true, blank: false, schema: {},
} as FormField;

function day(date: Date): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date);
}

describe('DatePicker', () => {
  it('is the input of a date, marked as the one it replaces', () => {
    const onChange = vi.fn();
    render(<DatePicker data-bz="field:due" value="2030-03-04" onChange={onChange} />);
    const input = screen.getByTestId<HTMLInputElement>('field:due');
    expect([input.tagName, input.type, input.value]).toEqual(['INPUT', 'date', '2030-03-04']);
    fireEvent.change(input, { target: { value: '2030-03-05' } });
    expect(onChange).toHaveBeenLastCalledWith('2030-03-05');
  });

  it('picks a day of the month of the date in its calendar', async () => {
    function Form() {
      const [value, setValue] = useState<unknown>('2030-03-04');
      return (
        <DatePickerProvider>
          <FieldInput field={due} value={value} onChange={setValue} />
        </DatePickerProvider>
      );
    }
    render(
      <LanguageProvider store={testLanguages('en')}>
        <Form />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose a date' }));
    fireEvent.click(await screen.findByRole('button', { name: day(new Date(2030, 2, 9)) }));
    expect(screen.getByTestId<HTMLInputElement>('field:due').value).toBe('2030-03-09');
    // closed once picked
    expect(screen.queryByRole('button', { name: day(new Date(2030, 2, 10)) })).toBeNull();
  });

  it('has no calendar when the input is read-only', () => {
    render(<DatePicker data-bz="field:due" value="2030-03-04" readOnly onChange={vi.fn()} />);
    expect(screen.getByTestId('field:due').hasAttribute('readonly')).toBe(true);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
