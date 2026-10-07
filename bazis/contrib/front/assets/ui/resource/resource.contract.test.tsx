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

// The contract of the fields: the control of every field is `field:<name>`, its errors
// `error:<name>`, a read-only field cannot be changed. Keep it passing when the component is
// changed.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormField } from '@/bazis/react';
import { FieldInput, FieldValue, formatValue, permitted } from '@/bazis/ui/resource';
import { Backend, renderWithBazis } from '@/bazis/ui/testing';

const base = { required: false, readOnly: false, nullable: false };

function attribute(name: string, type: string, extra: Partial<FormField> = {}): FormField {
  return { ...base, kind: 'attribute', name, title: name, type, format: null, enum: null, schema: {}, ...extra } as FormField;
}

describe('FieldInput', () => {
  it('marks the control and the errors of a field', () => {
    const onChange = vi.fn();
    render(<FieldInput field={attribute('title', 'string', { title: 'Title' })} value="A" onChange={onChange} errors={['Required']} />);
    const control = screen.getByTestId('field:title');
    expect(screen.getByLabelText('Title')).toBe(control);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByTestId('error:title').textContent).toBe('Required');
    fireEvent.change(control, { target: { value: 'B' } });
    expect(onChange).toHaveBeenCalledWith('B');
  });

  it('renders the controls by type and keeps read-only fields', () => {
    const onChange = vi.fn();
    render(
      <>
        <FieldInput field={attribute('done', 'boolean')} value={false} onChange={onChange} />
        <FieldInput field={attribute('count', 'integer')} value={1} onChange={onChange} />
        <FieldInput field={attribute('state', 'string', { enum: ['new', 'done'] })} value="new" onChange={onChange} />
        <FieldInput field={attribute('code', 'string', { readOnly: true })} value="X" onChange={onChange} />
      </>,
    );
    fireEvent.click(screen.getByTestId('field:done'));
    expect(onChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getByTestId('field:count'), { target: { value: '5' } });
    expect(onChange).toHaveBeenLastCalledWith(5);
    fireEvent.change(screen.getByTestId('field:state'), { target: { value: 'done' } });
    expect(onChange).toHaveBeenLastCalledWith('done');
    expect(screen.getByTestId('field:code').hasAttribute('readonly')).toBe(true);
  });

  it('renders a to-one relationship', () => {
    const field: FormField = { ...base, kind: 'relation', name: 'owner', title: 'Owner', relation: 'test.unknown', many: false };
    renderWithBazis(<FieldInput field={field} value="u1" onChange={vi.fn()} />, new Backend());
    expect(screen.getByTestId<HTMLInputElement>('field:owner').value).toBe('u1');
  });
});

describe('FieldValue', () => {
  it('formats the values', () => {
    expect(formatValue(undefined, null)).toBe('—');
    expect(formatValue(undefined, true)).toBe('Yes');
    expect(formatValue(attribute('dt', 'string', { format: 'date-time' }), 'oops')).toBe('oops');
    render(<FieldValue field={attribute('title', 'string')} value="Report" />);
    expect(screen.getByText('Report')).toBeTruthy();
  });
});

describe('permitted', () => {
  it('reads the permission meta, and allows without it', () => {
    expect(permitted({ for_change: ['a'] }, 'change', 'a')).toBe(true);
    expect(permitted({ for_change: ['a'] }, 'change', 'b')).toBe(false);
    expect(permitted({ for_create: false }, 'add')).toBe(false);
    expect(permitted({ crud_actions: ['view'] }, 'change')).toBe(false);
    expect(permitted({}, 'delete', 'a')).toBe(true);
    expect(permitted(undefined, 'add')).toBe(true);
  });
});
