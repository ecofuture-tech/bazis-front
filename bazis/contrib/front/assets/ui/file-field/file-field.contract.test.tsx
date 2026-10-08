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

// The contract of the file field: the input `field:<name>` in `upload:<name>` (`aria-busy`
// while its file uploads), the upload of a chosen file and the id of its item as the value,
// the files refused before they are sent (too large, of another type), the errors of the
// backend, the cancel, the replace and the remove; and in a form (`FieldInput` under
// `FileFieldProvider`), the errors of the file as `error:<name>`. Keep it passing when the
// component is changed.

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi, type Mock } from 'vitest';

import type { RelationField } from '@/bazis/react';
import { accepts, FileField, FileFieldProvider, type FileFieldProps } from '@/bazis/ui/file-field';
import { FieldInput } from '@/bazis/ui/resource';
import { Backend, listDocument, renderWithBazis, resource } from '@/bazis/ui/testing';

/** The route set of the uploaded files of the tests, of no product. */
const FILES = '/api/test/file/';

const FIELD: RelationField = {
  kind: 'relation',
  name: 'attachment',
  title: 'Attachment',
  required: false,
  readOnly: false,
  nullable: true,
  relation: 'test.file',
  many: false,
};

/** An item of the uploaded files: its id is a number, as the core returns it for an integer primary key. */
function uploaded(id: number, name: string, size = 11) {
  return {
    ...resource(String(id), { file: `/media/files/${name}`, name, extension: name.split('.').pop(), size }, {}, 'test.file'),
    id,
  };
}

const BRIEF = new File(['hello world'], 'brief.txt', { type: 'text/plain' });

interface Spies {
  onChange: Mock<(value: string | null) => void>;
  onBusy: Mock<(busy: boolean) => void>;
  onError: Mock<(message: string | null) => void>;
}

/** The field with its value in a state, as a form holds it. */
function Field({ initial = null, spies, ...props }: Partial<FileFieldProps> & { initial?: string | null; spies: Spies }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <FileField
      field={FIELD}
      value={value}
      disabled={false}
      control={{ id: 'attachment', 'data-bz': 'field:attachment' }}
      path={FILES}
      maxSize={null}
      onChange={(next) => {
        spies.onChange(next);
        setValue(next);
      }}
      onBusy={spies.onBusy}
      onError={spies.onError}
      {...props}
    />
  );
}

function spies(): Spies {
  return { onChange: vi.fn(), onBusy: vi.fn(), onError: vi.fn() };
}

function choose(file: File) {
  fireEvent.change(screen.getByTestId('field:attachment'), { target: { files: [file] } });
}

describe('FileField', () => {
  it('uploads the chosen file and takes the id of its item', async () => {
    const backend = new Backend()
      .on('POST', FILES, { data: uploaded(1, 'brief.txt') }, 201)
      .on('GET', FILES, listDocument([uploaded(1, 'brief.txt')]));
    const field = spies();
    renderWithBazis(<Field spies={field} />, backend);

    expect(screen.getByTestId('upload:attachment').textContent).toContain('Drop a file here');
    expect(screen.getByTestId('field:attachment')).toHaveProperty('type', 'file');
    choose(BRIEF);
    await waitFor(() => {
      expect(field.onChange).toHaveBeenCalledWith('1');
    });
    expect(backend.calls.find((it) => it.method === 'POST')).toEqual({ method: 'POST', url: FILES, body: { file: 'brief.txt' } });
    expect(field.onBusy.mock.calls).toEqual([[true], [false]]);
    expect(field.onError).toHaveBeenCalledWith(null);
    // the file of the value: a link to it, with its size
    const link = await screen.findByRole('link', { name: 'brief.txt' });
    expect(link.getAttribute('href')).toBe('/media/files/brief.txt');
    expect(screen.getByTestId('upload:attachment').textContent).toContain('11 B');
    expect(screen.getByTestId('upload:attachment').getAttribute('aria-busy')).toBeNull();
  });

  it('is busy while the file uploads, and the cancel keeps the value', async () => {
    const backend = new Backend()
      .hold('POST', FILES)
      .on('GET', FILES, listDocument([uploaded(5, 'old.txt')]));
    const field = spies();
    renderWithBazis(<Field spies={field} initial="5" />, backend);
    await screen.findByRole('link', { name: 'old.txt' });

    choose(BRIEF);
    await waitFor(() => {
      expect(screen.getByTestId('upload:attachment').getAttribute('aria-busy')).toBe('true');
    });
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByTestId('upload:attachment').textContent).toContain('brief.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.getByTestId('upload:attachment').getAttribute('aria-busy')).toBeNull();
    });
    expect(await screen.findByRole('link', { name: 'old.txt' })).toBeTruthy();
    expect(field.onChange).not.toHaveBeenCalled();
    expect(field.onBusy.mock.calls).toEqual([[true], [false]]);
  });

  it('does not send a file larger than the limit or of another type', () => {
    const backend = new Backend();
    const large = spies();
    const { unmount } = renderWithBazis(<Field spies={large} maxSize={10} />, backend);
    expect(screen.getByTestId('upload:attachment').textContent).toContain('up to 10 B');
    choose(BRIEF);
    expect(large.onError).toHaveBeenCalledWith('The file is larger than 10 B.');
    unmount();

    const typed = spies();
    renderWithBazis(<Field spies={typed} accept="image/*,.pdf" />, backend);
    expect(screen.getByTestId('field:attachment').getAttribute('accept')).toBe('image/*,.pdf');
    choose(BRIEF);
    expect(typed.onError).toHaveBeenCalledWith('The file is not of the type image/*,.pdf.');
    expect(backend.calls).toEqual([]);
    expect(large.onBusy).not.toHaveBeenCalled();
  });

  it('reports the error of the backend', async () => {
    const backend = new Backend().on(
      'POST',
      FILES,
      { errors: [{ status: 413, code: 'ERR_FILE_TOO_LARGE', detail: 'The file is larger than 10 bytes' }] },
      413,
    );
    const field = spies();
    renderWithBazis(<Field spies={field} />, backend);
    choose(BRIEF);
    await waitFor(() => {
      expect(field.onError).toHaveBeenLastCalledWith('The file is larger than 10 bytes');
    });
    expect(field.onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('upload:attachment').textContent).toContain('Drop a file here');
  });

  it('replaces and removes the file', async () => {
    const backend = new Backend()
      .on('POST', FILES, { data: uploaded(2, 'new.txt') }, 201)
      .on('GET', FILES, listDocument([uploaded(1, 'brief.txt'), uploaded(2, 'new.txt')]));
    const field = spies();
    renderWithBazis(<Field spies={field} initial="1" />, backend);
    await screen.findByRole('link', { name: 'brief.txt' });
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();

    choose(new File(['new'], 'new.txt'));
    await waitFor(() => {
      expect(field.onChange).toHaveBeenCalledWith('2');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(field.onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId('upload:attachment').textContent).toContain('Drop a file here');
  });

  it('has no remove for a required file, and no change when disabled', async () => {
    const backend = new Backend().on('GET', FILES, listDocument([uploaded(1, 'brief.txt')]));
    const { unmount } = renderWithBazis(
      <Field spies={spies()} initial="1" field={{ ...FIELD, required: true, nullable: false }} />,
      backend,
    );
    await screen.findByRole('link', { name: 'brief.txt' });
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    unmount();

    renderWithBazis(<Field spies={spies()} initial="1" disabled />, backend);
    await screen.findByRole('link', { name: 'brief.txt' });
    expect(screen.getByTestId('field:attachment')).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull();
  });

  it('accepts by MIME type, by wildcard and by extension', () => {
    const png = new File([''], 'Photo.PNG', { type: 'image/png' });
    expect(accepts(png, undefined)).toBe(true);
    expect(accepts(png, 'image/*')).toBe(true);
    expect(accepts(png, '.png')).toBe(true);
    expect(accepts(png, 'image/png')).toBe(true);
    expect(accepts(png, '.pdf, application/pdf')).toBe(false);
  });
});

describe('FileFieldProvider', () => {
  it('makes FileField the control of a file field of FieldInput, with its errors as error:<name>', () => {
    const backend = new Backend();
    const onChange = vi.fn();
    renderWithBazis(
      <FileFieldProvider resources={['test.file']} maxSize={10}>
        <FieldInput field={FIELD} value={null} onChange={onChange} />
      </FileFieldProvider>,
      backend,
    );
    expect(screen.getByTestId('upload:attachment')).toBeTruthy();
    // the label of the field is that of its input
    expect(screen.getByLabelText('Attachment')).toBe(screen.getByTestId('field:attachment'));
    act(() => {
      choose(BRIEF);
    });
    expect(screen.getByTestId('error:attachment').textContent).toBe('The file is larger than 10 B.');
    expect(screen.getByTestId('field:attachment').getAttribute('aria-invalid')).toBe('true');
    expect(onChange).not.toHaveBeenCalled();
  });
});
