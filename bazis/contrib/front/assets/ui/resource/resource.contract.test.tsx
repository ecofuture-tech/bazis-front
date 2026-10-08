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
// `error:<name>`, a read-only field cannot be changed; a file field (a to-one relationship to
// the uploaded files) is edited by the control of `FilesProvider` and shown as a file. Keep
// it passing when the component is changed.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormField } from '@/bazis/react';
import {
  FieldInput,
  FieldValue,
  FilesProvider,
  FileValue,
  formatSize,
  formatValue,
  permitted,
  type FileControlProps,
} from '@/bazis/ui/resource';
import { Backend, listDocument, renderWithBazis, resource } from '@/bazis/ui/testing';

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

describe('file fields', () => {
  const FILES = '/api/test/file/';
  const file: FormField = { ...base, kind: 'relation', name: 'attachment', title: 'Attachment', relation: 'test.file', many: false };

  function Control({ value, control, onChange, onError }: FileControlProps) {
    return (
      <input
        {...control}
        type="file"
        data-value={value ?? ''}
        onChange={() => {
          onError('Too large');
          onChange('9');
        }}
      />
    );
  }

  it('edits a file field with the control of FilesProvider, its error with those of the field', () => {
    const onChange = vi.fn();
    renderWithBazis(
      <FilesProvider control={Control} resources={['test.file']}>
        <FieldInput field={file} value="3" onChange={onChange} errors={['Required']} />
      </FilesProvider>,
      new Backend(),
    );
    const control = screen.getByTestId('field:attachment');
    expect(control.getAttribute('data-value')).toBe('3');
    expect(screen.getByLabelText('Attachment')).toBe(control);
    fireEvent.change(control);
    expect(onChange).toHaveBeenCalledWith('9');
    expect(screen.getByTestId('error:attachment').textContent).toBe('Required Too large');
  });

  it('edits a file field with the picker of a relationship without a control', () => {
    renderWithBazis(
      <FilesProvider control={null} resources={['test.file']}>
        <FieldInput field={file} value="3" onChange={vi.fn()} />
      </FilesProvider>,
      new Backend(),
    );
    // the picker of a relationship (of a resource without a route here: its id)
    expect(screen.getByTestId<HTMLInputElement>('field:attachment').value).toBe('3');
    expect(screen.getByTestId('field:attachment').getAttribute('type')).not.toBe('file');
  });

  it('shows a file: its link, its size, the thumbnail of an image', async () => {
    const item = (id: string, name: string, size: number) =>
      resource(id, { file: `/media/${name}`, name, extension: name.split('.').pop(), size }, {}, 'test.file');
    const backend = new Backend().on('GET', FILES, listDocument([item('1', 'brief.txt', 2048), item('2', 'photo.png', 11)]));
    renderWithBazis(
      <FilesProvider control={null} resources={['test.file']}>
        <span data-bz="field:attachment">
          <FileValue relation="test.file" id="1" path={FILES} />
        </span>
        <FileValue relation="test.file" id="2" path={FILES} />
        {/* the file of a field (the resource of the tests has no route in ROUTES: its id) */}
        <span data-bz="field:other">
          <FieldValue field={file} value="3" />
        </span>
      </FilesProvider>,
      backend,
    );
    const link = await screen.findByRole('link', { name: 'brief.txt' });
    expect(link.getAttribute('href')).toBe('/media/brief.txt');
    expect(screen.getByTestId('field:attachment').textContent).toBe('brief.txt2 KB');
    // the files of a page are read with one request
    await screen.findByRole('link', { name: 'photo.png' });
    expect(backend.requests('GET')).toHaveLength(1);
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/media/photo.png');
    expect(screen.getByTestId('field:other').textContent).toBe('3');
  });

  it('formats the sizes', () => {
    expect([formatSize(11), formatSize(1536), formatSize(10 * 1024 * 1024), formatSize(3 * 1024 ** 3)]).toEqual([
      '11 B',
      '1.5 KB',
      '10 MB',
      '3 GB',
    ]);
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
