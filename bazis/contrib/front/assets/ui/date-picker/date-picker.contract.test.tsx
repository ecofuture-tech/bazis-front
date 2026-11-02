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

// The contract of the date picker: the input of a date shows it in the numeric format of the
// language of the product (`02.11.2026` in Russian), takes it typed so with any separator or as
// `2026-10-07` (the scenarios fill it so), with the marks of the input it replaces
// (`field:<name>`, `data-input="date"`), and stays `<input type="date">` with `mode: native`
// (`controls.date` of the theme); its button opens the month of the date, whose days give the
// date picked: every input of a date below `DatePickerProvider` (the forms, the filters of the
// lists). Keep it passing when the component is changed.

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
  it('shows the date in the numeric format of the language, marked as the input it replaces', () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <LanguageProvider store={testLanguages('ru')}>
        <DatePicker data-bz="field:due" value="2030-03-04" onChange={onChange} />
      </LanguageProvider>,
    );
    const input = screen.getByTestId<HTMLInputElement>('field:due');
    expect([input.tagName, input.type, input.inputMode, input.dataset.input]).toEqual(['INPUT', 'text', 'numeric', 'date']);
    expect(input.value).toBe('04.03.2030');
    expect(input.placeholder).toBe('дд.мм.гггг');
    unmount();
    render(
      <LanguageProvider store={testLanguages('en')}>
        <DatePicker data-bz="field:due" value="" onChange={onChange} />
      </LanguageProvider>,
    );
    expect(screen.getByTestId<HTMLInputElement>('field:due').value).toBe('');
    expect(screen.getByTestId<HTMLInputElement>('field:due').placeholder).toBe('mm/dd/yyyy');
  });

  it('takes a date typed in the order of the language with any separator, or as the backend writes it', () => {
    const onChange = vi.fn();
    render(
      <LanguageProvider store={testLanguages('ru')}>
        <DatePicker data-bz="field:due" value="2030-03-04" onChange={onChange} />
      </LanguageProvider>,
    );
    const input = screen.getByTestId<HTMLInputElement>('field:due');
    fireEvent.change(input, { target: { value: '5/3/2030' } });
    expect(onChange).toHaveBeenLastCalledWith('2030-03-05');
    fireEvent.change(input, { target: { value: '2030-12-01' } });
    expect(onChange).toHaveBeenLastCalledWith('2030-12-01');
    // what is being typed stays as it is
    expect(input.value).toBe('2030-12-01');
    // a text that is not a date yet, or never one, changes nothing
    onChange.mockClear();
    for (const text of ['01.12', '31.02.2030', '01.12.30', '2030-02-30']) {
      fireEvent.change(input, { target: { value: text } });
    }
    expect(onChange).not.toHaveBeenCalled();
    // an empty input is no date
    fireEvent.change(input, { target: { value: ' ' } });
    expect(onChange).toHaveBeenLastCalledWith('');
    // left, it shows the date of the field
    fireEvent.change(input, { target: { value: '01.12' } });
    fireEvent.blur(input);
    expect(input.value).toBe('04.03.2030');
  });

  it('is the input of the browser with `mode: native`', () => {
    const onChange = vi.fn();
    render(<DatePicker data-bz="field:due" mode="native" value="2030-03-04" onChange={onChange} />);
    const input = screen.getByTestId<HTMLInputElement>('field:due');
    expect([input.tagName, input.type, input.value, input.dataset.input]).toEqual(['INPUT', 'date', '2030-03-04', 'date']);
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
    expect(screen.getByTestId<HTMLInputElement>('field:due').value).toBe('03/09/2030');
    // closed once picked
    expect(screen.queryByRole('button', { name: day(new Date(2030, 2, 10)) })).toBeNull();
  });

  it('has no calendar when the input is read-only', () => {
    render(<DatePicker data-bz="field:due" value="2030-03-04" readOnly onChange={vi.fn()} />);
    expect(screen.getByTestId('field:due').hasAttribute('readonly')).toBe(true);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
