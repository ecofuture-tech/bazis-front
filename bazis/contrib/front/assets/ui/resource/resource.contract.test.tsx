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
// the uploaded files) is edited by the control of `FilesProvider` and shown as a file; a point
// field (GeoJSON) is edited and shown as its coordinates; a status is a badge of its tone,
// `status:<id>`. Keep it passing when the component is changed.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RESOURCES, TRANSITS } from '@/bazis/generated/contract';
import { THEME } from '@/bazis/generated/theme';
import type { FormField } from '@/bazis/react';
import {
  choiceOptions,
  DatesProvider,
  FieldInput,
  FieldValue,
  FilesProvider,
  FileValue,
  formatSize,
  formatValue,
  itemLabel,
  itemName,
  parsePoint,
  permitted,
  PointsProvider,
  RelationLabel,
  SOFT_TONES,
  StatusLabel,
  statusName,
  statusTone,
  useAnyRelated,
  useListFields,
  workflowStatuses,
  type DateInputProps,
  type FileControlProps,
} from '@/bazis/ui/resource';
import { Backend, errors, ITEMS, renderWithBazis, resource, runtimeSchema, testLanguages } from '@/bazis/ui/testing';

const base = { required: false, readOnly: false, nullable: false };

// the contract of the product as plain records, never by a cast: empty (a product before its
// first model), its literal maps are `{}`, and a cast of them is one the lint finds unnecessary;
// a field with other keys only (a relationship of a contract without titles) is one of them
const CONTRACT: Readonly<
  Record<string, { path: string; label?: readonly string[]; fields: Readonly<Record<string, { readonly [key: string]: unknown; title?: string }>> }>
> = RESOURCES;
const STATUSY: Readonly<
  Record<string, { initial: string; statuses: readonly { id: string }[]; transits: readonly { src: string; dst: string }[] }>
> = TRANSITS;

function attribute(name: string, type: string, extra: Partial<FormField> = {}): FormField {
  return { ...base, kind: 'attribute', name, title: name, type, format: null, enum: null, labels: null, blank: false, schema: {}, ...extra } as FormField;
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

  it('edits a URL as a URL, cleared to the empty string when the field allows it', () => {
    const onChange = vi.fn();
    render(
      <>
        <FieldInput field={attribute('site', 'string', { format: 'uri', blank: true, schema: { maxLength: 200 } })} value="https://a.example/" onChange={onChange} />
        <FieldInput field={attribute('link', 'string', { format: 'uri', nullable: true })} value="https://b.example/" onChange={onChange} />
      </>,
    );
    const site = screen.getByTestId<HTMLInputElement>('field:site');
    expect([site.type, site.maxLength]).toEqual(['url', 200]);
    fireEvent.change(site, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
    fireEvent.change(screen.getByTestId('field:link'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('edits a date with the input of the browser, or the control of DatesProvider', () => {
    const onChange = vi.fn();
    const due = attribute('due', 'string', { format: 'date', nullable: true });
    const { unmount } = render(<FieldInput field={due} value="2030-03-04" onChange={onChange} />);
    const native = screen.getByTestId<HTMLInputElement>('field:due');
    expect([native.type, native.value]).toEqual(['date', '2030-03-04']);
    fireEvent.change(native, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
    unmount();

    function Picker({ value, onChange: change, ...rest }: DateInputProps) {
      const pick = () => {
        change('2030-03-09');
      };
      return <button type="button" {...(rest as object)} data-value={value} onClick={pick} />;
    }
    render(
      <DatesProvider control={Picker}>
        <FieldInput field={due} value="2030-03-04" onChange={onChange} />
      </DatesProvider>,
    );
    const picker = screen.getByTestId('field:due');
    expect([picker.tagName, picker.getAttribute('data-value')]).toEqual(['BUTTON', '2030-03-04']);
    fireEvent.click(picker);
    expect(onChange).toHaveBeenLastCalledWith('2030-03-09');
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

  it('shows a file: its name, its size, the thumbnail of an image read with the token', async () => {
    // jsdom has no object URLs
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() });
    const item = (id: string, name: string, size: number) =>
      resource(id, { file: `/media/${name}`, name, extension: name.split('.').pop(), size }, {}, 'test.file');
    // read with the retrieve of the route set: it may have no list
    const backend = new Backend()
      .on('GET', `${FILES}1/`, { data: item('1', 'brief.txt', 2048) })
      .on('GET', `${FILES}2/`, { data: item('2', 'photo.png', 11) })
      .file(`${FILES}2/download/`, 'png', 'inline; filename="photo.png"');
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
    // never a link to the URL of the media host, which serves the file without the token
    await screen.findByRole('button', { name: 'brief.txt' });
    expect(screen.getByTestId('field:attachment').textContent).toBe('brief.txt2 KB');
    await screen.findByRole('button', { name: 'photo.png' });
    await waitFor(() => {
      expect(document.querySelector('img')?.getAttribute('src')).toBe('blob:photo');
    });
    expect(screen.queryByRole('link')).toBeNull();
    // the thumbnail of the image only: the other file is read when it is downloaded
    expect(backend.requests('GET').sort()).toEqual([`GET ${FILES}1/`, `GET ${FILES}2/`, `GET ${FILES}2/download/`]);
    expect(screen.getByTestId('field:other').textContent).toBe('3');
  });

  it('downloads a file with the token, and says when it fails', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:brief'), revokeObjectURL: vi.fn() });
    const saved = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const backend = new Backend()
      .on('GET', `${FILES}1/`, { data: resource('1', { file: '/media/brief.txt', name: 'brief.txt', size: 3 }, {}, 'test.file') })
      .file(`${FILES}1/download/`, 'brief', 'attachment; filename="brief.txt"');
    const onRow = vi.fn();
    renderWithBazis(
      <div onClick={onRow}>
        <FilesProvider control={null} resources={['test.file']}>
          <FileValue relation="test.file" id="1" path={FILES} />
        </FilesProvider>
      </div>,
      backend,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'brief.txt' }));
    await waitFor(() => {
      expect(saved).toHaveBeenCalledOnce();
    });
    expect((saved.mock.contexts[0] as HTMLAnchorElement).download).toBe('brief.txt');
    // the button of a row downloads the file, it does not open the row
    expect(onRow).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();

    backend.on('GET', `${FILES}1/download/`, errors(404), 404);
    fireEvent.click(screen.getByRole('button', { name: 'brief.txt' }));
    await screen.findByRole('alert');
    expect(saved).toHaveBeenCalledOnce();
    saved.mockRestore();
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

describe('point fields', () => {
  const location = attribute('location', 'object', { title: 'Location', nullable: true });
  const point = (latitude: number, longitude: number) => ({ type: 'Point', coordinates: [longitude, latitude] });

  // the value of the field, as a form keeps it
  function Controlled({ initial, onChange, path }: { initial: unknown; onChange: (value: unknown) => void; path: string | undefined }) {
    const [value, setValue] = useState(initial);
    return (
      <FieldInput
        path={path}
        field={location}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }

  function field(value: unknown, onChange = vi.fn(), path: string | null = ITEMS) {
    return renderWithBazis(
      <PointsProvider control={null} fields={{ [ITEMS]: ['location'] }}>
        <Controlled initial={value} onChange={onChange} path={path ?? undefined} />
      </PointsProvider>,
      new Backend(),
    );
  }

  it('edits the coordinates of a point field and gives GeoJSON', () => {
    const onChange = vi.fn();
    field(point(55.7558, 37.6173), onChange);
    const control = screen.getByTestId<HTMLInputElement>('field:location');
    expect(control.value).toBe('55.7558, 37.6173');
    // every keyboard has the separators and the minus
    expect(control.inputMode).toBe('text');
    expect(screen.getByLabelText('Location')).toBe(control);
    fireEvent.change(control, { target: { value: '-33.86;151.21' } });
    expect(onChange).toHaveBeenLastCalledWith(point(-33.86, 151.21));
    // not a point yet: the text, which the backend refuses with the error of the field
    fireEvent.change(control, { target: { value: '95, 10' } });
    expect(onChange).toHaveBeenLastCalledWith('95, 10');
    expect(control.value).toBe('95, 10');
    // cleared: null for a nullable field
    fireEvent.change(control, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('is the JSON of the object outside a route set of the point field', () => {
    field(point(1, 2), vi.fn(), null);
    expect(screen.getByTestId('field:location').tagName).toBe('TEXTAREA');
  });

  it('reads the coordinates', () => {
    expect(parsePoint('55.7558, 37.6173')).toEqual({ latitude: 55.7558, longitude: 37.6173 });
    expect(parsePoint(' -1 2 ')).toEqual({ latitude: -1, longitude: 2 });
    // a decimal comma, separated by a semicolon or a space
    expect(parsePoint('55,7558; 37,6173')).toEqual({ latitude: 55.7558, longitude: 37.6173 });
    expect(parsePoint('-33,86 151,21')).toEqual({ latitude: -33.86, longitude: 151.21 });
    expect(parsePoint('55,75;37')).toEqual({ latitude: 55.75, longitude: 37 });
    // integers separated by a comma; an ambiguous or an out of range text is no point
    expect(parsePoint('55,37')).toEqual({ latitude: 55, longitude: 37 });
    expect([parsePoint('91, 0'), parsePoint('0, 181'), parsePoint('55,7,37,6'), parsePoint('55,7, 37,6'), parsePoint('north')]).toEqual([
      null, null, null, null, null,
    ]);
  });

  it('shows a point as its coordinates, in every language', () => {
    expect(formatValue(location, point(55.75580001, 37.6173))).toBe('55.7558, 37.6173');
    expect(formatValue(location, { type: 'Polygon', coordinates: [] })).toBe('{"type":"Polygon","coordinates":[]}');
    render(<FieldValue field={location} value={point(-33.86, 151.21)} />);
    expect(screen.getByText('-33.86, 151.21')).toBeTruthy();
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

  it('marks a text of the item, not a value short by its nature', () => {
    const kind = attribute('kind', 'string', { enum: ['offer'], labels: { offer: 'Offer' } });
    const { container } = render(
      <>
        <FieldValue field={attribute('title', 'string')} value="Report" />
        <FieldValue field={kind} value="offer" />
        <FieldValue field={attribute('due', 'string', { format: 'date' })} value="2026-10-18" />
        <FieldValue field={attribute('count', 'integer')} value={3} />
        <FieldValue field={attribute('done', 'boolean')} value={true} />
      </>,
    );
    expect([...container.querySelectorAll('[data-text]')].map((it) => it.textContent)).toEqual(['Report']);
  });

  it('formats the values in the language of the interface', () => {
    const russian = testLanguages('ru');
    renderWithBazis(
      <>
        <span data-bz="field:done">
          <FieldValue field={attribute('done', 'boolean')} value={true} />
        </span>
        <span data-bz="field:count">
          <FieldValue field={attribute('count', 'number')} value={12345.5} />
        </span>
        <span data-bz="field:day">
          <FieldValue field={attribute('day', 'string', { format: 'date' })} value="2026-10-08" />
        </span>
      </>,
      new Backend(),
      { language: russian },
    );
    expect(screen.getByTestId('field:done').textContent).toBe('Да');
    expect(screen.getByTestId('field:count').textContent).toMatch(/^12\s345,5$/);
    expect(screen.getByTestId('field:day').textContent).toMatch(/^8 окт\. 2026\sг\.$/);
    expect(formatSize(1536, { language: 'ru', t: (key, params) => `${key}:${String(params?.size)}` })).toBe('size.kb:1,5');
  });

  it('groups the thousands of a number from five digits, never those of `display: plain`', () => {
    const year = attribute('year', 'integer');
    expect(formatValue(year, 2020)).toBe('2020');
    expect(formatValue(year, -1234.5)).toBe('-1234.5');
    expect(formatValue(year, 18770)).toBe('18,770');
    expect(formatValue(year, 18770, { language: 'ru', t: (key) => key })).toMatch(/^18\s770$/);
    expect(formatValue(year, 18770, undefined, 'plain')).toBe('18770');
    render(<FieldValue field={year} value={1877} display="plain" />);
    expect(screen.getByText('1877')).toBeTruthy();
  });

  it('shows a phone (`display: phone`) in groups, as a link to call it', () => {
    const phone = attribute('phone', 'string');
    expect(formatValue(phone, '+79161234567', undefined, 'phone')).toBe('+7 916 123-45-67');
    expect(formatValue(phone, '9161234567', undefined, 'phone')).toBe('916 123-45-67');
    // written with separators: as it is
    expect(formatValue(phone, '+44 20 7946 0958', undefined, 'phone')).toBe('+44 20 7946 0958');
    const { unmount } = render(<FieldValue field={phone} value="+7 (916) 123-45-67" display="phone" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('tel:+79161234567');
    unmount();
    // without a digit: a text, never a link to call nothing
    render(<FieldValue field={phone} value="ask the office" display="phone" />);
    expect(screen.getByText('ask the office')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows a sum in its currency (`display: {currency}`), a quantity with its unit (`{unit}`)', () => {
    const price = attribute('price', 'string');
    // a DecimalField: its exact digits
    expect(formatValue(price, '45000.10', undefined, { currency: 'EUR' })).toBe('€45,000.10');
    expect(formatValue(attribute('total', 'number'), 12, undefined, { currency: 'EUR' })).toBe('€12.00');
    expect(formatValue(attribute('copies', 'integer'), 12000, undefined, { unit: 'pcs' })).toBe('12,000 pcs');
    expect(formatValue(attribute('copies', 'integer'), 1200, undefined, { unit: 'pcs' })).toBe('1200 pcs');
    expect(formatValue(price, '2.50', undefined, { unit: 'kg' })).toBe('2.50 kg');
    expect(formatValue(price, null, undefined, { unit: 'kg' })).toBe('—');
    // a code that is not of ISO 4217: after the number, as a unit, never an error of the render
    expect(formatValue(price, '45000.10', undefined, { currency: 'euro' })).toBe('45,000.10 euro');
    render(<FieldValue field={price} value="12.5" display={{ currency: 'euro' }} />);
    expect(screen.getByText('12.5 euro')).toBeTruthy();
  });

  it('shows a number with a bar of its share of the maximum (`display: {bar}`)', () => {
    const progress = attribute('progress', 'integer', { title: 'Progress' });
    const { unmount } = render(<FieldValue field={progress} value={50} display={{ bar: 200 }} />);
    const meter = screen.getByRole('meter', { name: 'Progress' });
    expect([meter.getAttribute('aria-valuenow'), meter.getAttribute('aria-valuemax'), meter.getAttribute('aria-valuetext')]).toEqual([
      '50',
      '200',
      '50',
    ]);
    expect((meter.firstElementChild as HTMLElement).style.width).toBe('25%');
    unmount();
    // over the maximum: a full bar, the value of the meter within its range, the real one in its text
    const over = render(<FieldValue field={progress} value={300} display={{ bar: 200 }} />);
    const full = screen.getByRole('meter');
    expect((full.firstElementChild as HTMLElement).style.width).toBe('100%');
    expect([full.getAttribute('aria-valuenow'), full.getAttribute('aria-valuetext')]).toEqual(['200', '300']);
    over.unmount();
    render(<FieldValue field={progress} value={-5} display={{ bar: 200 }} />);
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('0');
  });

  it('shows a decimal (a string of the API) of `display: {bar}` as its text, without a bar', () => {
    // `check` refuses it (S020: a bar is of an integer or a number); the value stays readable
    render(
      <span data-bz="field:share">
        <FieldValue field={attribute('share', 'string', { title: 'Share' })} value="12.50" display={{ bar: 50 }} />
      </span>,
    );
    expect(screen.getByTestId('field:share').textContent).toBe('12.50');
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('shows the status of a model that is not statusy as a related item', () => {
    // the status of a model that the contract does not have, or a relationship of another
    // resource named so: the label of the related item
    const status = { ...base, kind: 'relation', name: 'status', title: 'Status', relation: 'test.status', many: false } as FormField;
    render(
      <span data-bz="field:status">
        <FieldValue field={status} value="draft" type="test.item" />
      </span>,
    );
    expect(screen.getByTestId('field:status').textContent).toBe('draft');
  });

  // a status of a statusy model of the product, if it has one
  const statusy = Object.entries(STATUSY).flatMap(
    ([type, { statuses }]) => statuses.map(({ id }) => ({ type, id })),
  )[0];
  it.runIf(statusy)('names a status of a statusy model of the contract', () => {
    if (!statusy) return;
    const { type, id } = statusy;
    const status = { ...base, kind: 'relation', name: 'status', title: 'Status', relation: 'test.status', many: false } as FormField;
    render(
      <span data-bz="field:status">
        <FieldValue field={status} value={id} type={type} />
      </span>,
    );
    // in the language of the interface, English without a provider
    expect(screen.getByTestId('field:status').textContent).toBe(statusName(type, id, 'en'));
  });
});

describe('StatusLabel', () => {
  it('marks a status with its tone, in the soft colors of the tone', () => {
    render(<StatusLabel type="test.item" status="draft" />);
    const badge = screen.getByTestId('status:draft');
    // a model that the contract does not have: the id of the status
    expect(badge.textContent).toBe('draft');
    const tone = statusTone('draft');
    expect(badge.getAttribute('data-tone')).toBe(tone);
    for (const name of SOFT_TONES[tone].split(' ')) expect(badge.classList.contains(name)).toBe(true);
    // the tone of `statuses` of the theme, neutral for a status it does not name
    for (const [status, it] of Object.entries(THEME.statuses)) expect(statusTone(status)).toBe(it);
    expect(statusTone('a-status-of-no-theme')).toBe('neutral');
  });
});

describe('workflowStatuses', () => {
  it('orders the statuses of a model by its workflow: the initial one, then those its transits reach', () => {
    for (const [type, model] of Object.entries(STATUSY)) {
      const order = workflowStatuses(type);
      expect([...order].sort()).toEqual(model.statuses.map((it) => it.id).sort());
      expect(order[0]).toBe(model.initial);
      // a status that a transit reaches comes after the source of one of its transits
      for (const status of order.slice(1)) {
        const sources = model.transits.filter((it) => it.dst === status).map((it) => order.indexOf(it.src));
        if (sources.length) expect(Math.min(...sources)).toBeLessThan(order.indexOf(status));
      }
    }
    expect(workflowStatuses('test.item')).toEqual([]);
  });
});

describe('the titles of the fields', () => {
  it('titles a field without a title of its own, or with the default of Django, by its name as words', async () => {
    function Titles() {
      const fields = useListFields(ITEMS);
      const names = ['is_late', 'status_author', 'due_on'];
      return <span data-bz="field:title">{fields.ready ? names.map((name) => fields.title(name)).join('|') : ''}</span>;
    }
    const schema = runtimeSchema(
      {
        is_late: { attribute: { type: 'boolean' } },
        // the `verbose_name` that Django gives a field without one
        status_author: { attribute: { type: 'string', title: 'status author' } },
        due_on: { attribute: { type: 'string', title: 'due on (UTC)' } },
      },
      { list: true },
    );
    renderWithBazis(<Titles />, new Backend().on('GET', `${ITEMS}schema_list/`, schema));
    await waitFor(() => {
      expect(screen.getByTestId('field:title').textContent).toBe('Is late|Status author|due on (UTC)');
    });
  });
});

describe('the contract', () => {
  // a resource of the product with its label attributes, a field with a title of its own
  // a resource of the product labelled by other attributes than `name`, the first of `LABELS`
  const labelled = Object.entries(CONTRACT).find(([, it]) => (it.label?.length ?? 0) > 0 && !it.label?.includes('name'));
  const titled = Object.values(CONTRACT).flatMap((resource) =>
    Object.entries(resource.fields).flatMap(([name, field]) =>
      // a title of its own: neither its name nor the default `verbose_name` of Django
      field.title && field.title !== name && field.title !== name.replaceAll('_', ' ') ? [{ path: resource.path, name, title: field.title }] : [],
    ),
  )[0];

  it.runIf(labelled)('names an item by the label attributes of its resource, before the names of LABELS', () => {
    if (!labelled) return;
    const [type, { label = [] }] = labelled;
    // `name` (the first of LABELS) would name it otherwise
    const item = resource('1', { name: 'Other', ...Object.fromEntries(label.map((name, index) => [name, `N${String(index)}`])) }, {}, type);
    expect(itemName(item)).toBe(label.map((_, index) => `N${String(index)}`).join(' '));
    // without a value of them (a user without his names): by LABELS
    expect(itemName(resource('1', { name: 'Other' }, {}, type))).toBe('Other');
  });

  it('names an item of a type that the contract does not label by LABELS', () => {
    expect(itemName(resource('1', { title: 'Second', name: 'First' }, {}, 'test.unlabelled'))).toBe('First');
    expect(itemName(resource('1', { title: ' ' }, {}, 'test.unlabelled'))).toBeNull();
  });

  it.runIf(titled)('titles a field by the contract while its schema cannot be read', async () => {
    if (!titled) return;
    function Title() {
      const fields = useListFields(titled?.path ?? '');
      return <span data-bz="field:title">{fields.ready ? fields.title(titled?.name ?? '') : ''}</span>;
    }
    renderWithBazis(<Title />, new Backend().on('GET', `${titled.path}schema_list/`, errors(500), 500));
    await waitFor(() => {
      expect(screen.getByTestId('field:title').textContent).toBe(titled.title);
    });
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

  it('reads the custom actions of an item or a list (`custom_actions`), and allows without them', () => {
    expect(permitted({ crud_actions: ['view'], custom_actions: ['action_report'] }, 'action_report')).toBe(true);
    expect(permitted({ crud_actions: ['view'], custom_actions: [] }, 'action_report')).toBe(false);
    // the meta of a backend without bazis-permit 2.11, or not requested
    expect(permitted({ crud_actions: ['view'] }, 'action_report')).toBe(true);
    expect(permitted(null, 'action_report')).toBe(true);
  });
});

describe('the label of a related item', () => {
  it('is its first attribute of name, title, username, email, slug and code, else its id', () => {
    expect(itemLabel(resource('1', { code: 'C', email: 'ann@example.com', username: 'ann' }))).toBe('ann');
    expect(itemLabel(resource('1', { name: '', title: 'Plan', username: 'ann' }))).toBe('Plan');
    expect(itemLabel(resource('1', { slug: 's', code: 'C' }))).toBe('s');
    expect(itemLabel(resource('7', { size: 3 }))).toBe('7');
    expect(itemName(resource('7', { size: 3 }))).toBeNull();
    expect(itemName(resource('1', { title: 'Plan' }))).toBe('Plan');
  });

  it('is the display name of a person before his username and e-mail', () => {
    // a user of bazis-users: his first and last name, as `get_full_name()`
    const user = { username: 'ann', email: 'ann@example.com', first_name: 'Ann', last_name: 'Lee' };
    expect(itemLabel(resource('1', user))).toBe('Ann Lee');
    expect(itemLabel(resource('1', { ...user, last_name: '' }))).toBe('Ann');
    expect(itemLabel(resource('1', { ...user, first_name: ' ', last_name: '' }))).toBe('ann');
    // a full name of the resource (a candidate), before his e-mail
    expect(itemLabel(resource('1', { full_name: 'Petr Ivanov', email: 'petr@example.com' }))).toBe('Petr Ivanov');
    expect(itemLabel(resource('1', { name: 'Team', full_name: 'Ann Lee' }))).toBe('Team');
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
