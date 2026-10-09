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

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormField } from '@/bazis/react';
import {
  choiceOptions,
  FieldInput,
  FieldValue,
  FilesProvider,
  FileValue,
  formatSize,
  formatValue,
  itemLabel,
  permitted,
  RelationLabel,
  useAnyRelated,
  type FileControlProps,
} from '@/bazis/ui/resource';
import { Backend, errors, ITEMS, renderWithBazis, resource, testLanguages } from '@/bazis/ui/testing';

const base = { required: false, readOnly: false, nullable: false };

function attribute(name: string, type: string, extra: Partial<FormField> = {}): FormField {
  return { ...base, kind: 'attribute', name, title: name, type, format: null, enum: null, labels: null, schema: {}, ...extra } as FormField;
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

  it('edits a date-time in the time zone of the browser and gives it in UTC', () => {
    // the end-to-end tests fill `2030-03-04T10:00` in a browser in UTC (`timezoneId`)
    const onChange = vi.fn();
    render(
      <FieldInput field={attribute('dt_start', 'string', { format: 'date-time' })} value="2030-03-04T10:00:00Z" onChange={onChange} />,
    );
    const control = screen.getByTestId<HTMLInputElement>('field:dt_start');
    expect(control.type).toBe('datetime-local');
    const local = new Date('2030-03-04T10:00:00Z');
    const pad = (value: number) => String(value).padStart(2, '0');
    expect(control.value).toBe(
      `${String(local.getFullYear())}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`,
    );
    fireEvent.change(control, { target: { value: '2030-03-05T11:30' } });
    expect(onChange).toHaveBeenCalledWith(new Date('2030-03-05T11:30').toISOString());
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

  it('offers the choices of a field by their labels and gives their values', () => {
    // the labels are `enumDict` of the runtime schema, in the language of the backend
    const onChange = vi.fn();
    const level = attribute('level', 'integer', { enum: [1, 2], labels: { '1': 'Low', '2': 'High' }, nullable: true });
    render(<FieldInput field={level} value={1} onChange={onChange} />);
    const control = screen.getByTestId<HTMLSelectElement>('field:level');
    expect([...control.options].map((it) => [it.value, it.textContent])).toEqual([
      ['', '—'],
      ['1', 'Low'],
      ['2', 'High'],
    ]);
    expect(control.value).toBe('1');
    fireEvent.change(control, { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith(2);
    fireEvent.change(control, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
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
    // read with the retrieve of the route set: it may have no list
    const backend = new Backend()
      .on('GET', `${FILES}1/`, { data: item('1', 'brief.txt', 2048) })
      .on('GET', `${FILES}2/`, { data: item('2', 'photo.png', 11) });
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
    await screen.findByRole('link', { name: 'photo.png' });
    expect(backend.requests('GET').sort()).toEqual([`GET ${FILES}1/`, `GET ${FILES}2/`]);
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/media/photo.png');
    expect(screen.getByTestId('field:other').textContent).toBe('3');
  });

  it('shows a file that the user may not read (another user uploaded it) as not available', async () => {
    const backend = new Backend()
      .on('GET', `${FILES}4/`, errors(404), 404)
      .on('GET', `${FILES}5/`, errors(500), 500);
    renderWithBazis(
      <FilesProvider control={null} resources={['test.file']}>
        <span data-bz="field:attachment">
          <FileValue relation="test.file" id="4" path={FILES} />
        </span>
        <span data-bz="field:other">
          <FileValue relation="test.file" id="5" path={FILES} />
        </span>
      </FilesProvider>,
      backend,
    );
    const hidden = await within(screen.getByTestId('field:attachment')).findByTestId('file:unavailable');
    expect(hidden.getAttribute('title')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    await within(screen.getByTestId('field:other')).findByTestId('file:unavailable');
    // the two states say different things
    expect(hidden.textContent).not.toBe(screen.getByTestId('field:other').textContent);
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
  it('shows a choice by its label, the choices of an array each', () => {
    const kind = attribute('kind', 'string', { enum: ['offer', 'invoice'], labels: { offer: 'Commercial offer', invoice: 'Invoice' } });
    const kinds = attribute('kinds', 'array', { enum: ['offer', 'invoice'], labels: { offer: 'Offer', invoice: 'Invoice' } });
    expect(formatValue(kind, 'offer')).toBe('Commercial offer');
    // a value the labels do not have (the backend changed its choices) is shown as it is
    expect(formatValue(kind, 'other')).toBe('other');
    expect(formatValue(kinds, ['invoice', 'offer'])).toBe('Invoice, Offer');
    expect(formatValue(kinds, [])).toBe('—');
    expect(choiceOptions(kind)).toEqual([
      { value: 'offer', label: 'Commercial offer' },
      { value: 'invoice', label: 'Invoice' },
    ]);
    expect(choiceOptions(attribute('title', 'string'))).toBeNull();
    render(<FieldValue field={kind} value="invoice" />);
    expect(screen.getByText('Invoice')).toBeTruthy();
  });

  it('formats the values', () => {
    expect(formatValue(undefined, null)).toBe('—');
    expect(formatValue(undefined, true)).toBe('Yes');
    expect(formatValue(attribute('dt', 'string', { format: 'date-time' }), 'oops')).toBe('oops');
    render(<FieldValue field={attribute('title', 'string')} value="Report" />);
    expect(screen.getByText('Report')).toBeTruthy();
  });

  it('formats the values in the language of the interface', () => {
    const russian = testLanguages('ru');
    renderWithBazis(
      <>
        <span data-bz="field:done">
          <FieldValue field={attribute('done', 'boolean')} value={true} />
        </span>
        <span data-bz="field:count">
          <FieldValue field={attribute('count', 'number')} value={1234.5} />
        </span>
        <span data-bz="field:day">
          <FieldValue field={attribute('day', 'string', { format: 'date' })} value="2026-10-08" />
        </span>
      </>,
      new Backend(),
      { language: russian },
    );
    expect(screen.getByTestId('field:done').textContent).toBe('Да');
    expect(screen.getByTestId('field:count').textContent).toMatch(/^1\s234,5$/);
    expect(screen.getByTestId('field:day').textContent).toMatch(/^8 окт\. 2026\sг\.$/);
    expect(formatSize(1536, { language: 'ru', t: (key, params) => `${key}:${String(params?.size)}` })).toBe('size.kb:1,5');
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

describe('the label of a related item', () => {
  it('is its first attribute of name, title, username, email, slug and code, else its id', () => {
    expect(itemLabel(resource('1', { code: 'C', email: 'ann@example.com', username: 'ann' }))).toBe('ann');
    expect(itemLabel(resource('1', { name: '', title: 'Plan', username: 'ann' }))).toBe('Plan');
    expect(itemLabel(resource('1', { slug: 's', code: 'C' }))).toBe('s');
    expect(itemLabel(resource('7', { size: 3 }))).toBe('7');
  });

  it('is read with the other items of the resource on the screen, also as a text', async () => {
    // a text of the product with the label (`t('booking.of', {name})`): the hook of
    // `RelationLabel` and `itemLabel`
    function Named({ id }: { id: string }) {
      const item = useAnyRelated(ITEMS, id);
      return <span data-bz="field:named">{item.data ? itemLabel(item.data) : id}</span>;
    }
    const backend = new Backend().on('GET', ITEMS, {
      data: [resource('1', { username: 'ann' }), resource('2', { title: 'Plan' })],
    });
    renderWithBazis(
      <>
        <span data-bz="field:label">
          <RelationLabel relation="test.item" id="1" path={ITEMS} />
        </span>
        <Named id="2" />
      </>,
      backend,
    );
    await waitFor(() => {
      expect(screen.getByTestId('field:label').textContent).toBe('ann');
    });
    expect(screen.getByTestId('field:named').textContent).toBe('Plan');
    expect(backend.requests('GET')).toHaveLength(1);
  });

  it('is the id of an item that the user may not view, which the hook gives as null', async () => {
    // the list leaves out the items the user may not view: a related user of another role
    const long = '0f5c8a9e-2b7d-4c1a-9e3f-5d6b7a8c9d0e';
    function Named({ id }: { id: string }) {
      const item = useAnyRelated(ITEMS, id);
      return <span data-bz="field:named">{item.isPending ? '' : item.data === null ? 'null' : 'an item'}</span>;
    }
    renderWithBazis(
      <>
        <span data-bz="field:short">
          <RelationLabel relation="test.item" id="7" path={ITEMS} />
        </span>
        <span data-bz="field:long">
          <RelationLabel relation="test.item" id={long} path={ITEMS} />
        </span>
        <Named id="7" />
      </>,
      new Backend().on('GET', ITEMS, { data: [] }),
    );
    await waitFor(() => {
      expect(screen.getByTestId('field:named').textContent).toBe('null');
    });
    expect(screen.getByTestId('field:short').textContent).toBe('7');
    // the start of a long id, the whole on hover
    expect(screen.getByTestId('field:long').textContent).toBe('#0f5c8a9e');
  });
});
