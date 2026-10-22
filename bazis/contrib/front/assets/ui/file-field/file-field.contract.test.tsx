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

// The contract of the file fields: the input `field:<name>` in `upload:<name>` (`aria-busy`
// while a file uploads), the upload of a chosen file and the id of its item as the value, the
// file chosen shown from its local copy (never read back: a guest may not), the files refused
// before they are sent (too large, of another type), the errors of the backend, the cancel, the
// replace and the remove; of several files (`FilesField`), the files listed (`file:<i>`) with
// their remove (`action:remove-file-<i>`), uploaded one after the other, their ids as the value,
// the local copies of the images dropped with their files; and in a form (`FieldInput` under
// `FileFieldProvider`), the errors of the file as `error:<name>`, the types of the guests; an
// image larger than the limit reduced to it (`fitImage`: a canvas, which the tests stub), never
// another file. Keep it passing when the component is changed.

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi, type Mock } from 'vitest';

import type { RelationField } from '@/bazis/react';
import {
  accepts,
  ANONYMOUS_ACCEPT,
  FileField,
  FileFieldProvider,
  FilesField,
  fitImage,
  type FileFieldProps,
  type FilesFieldProps,
} from '@/bazis/ui/file-field';
import { FieldInput } from '@/bazis/ui/resource';
import { Backend, renderWithBazis, resource, testLanguages } from '@/bazis/ui/testing';

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
    const backend = new Backend().on('POST', FILES, { data: uploaded(1, 'brief.txt') }, 201);
    const field = spies();
    renderWithBazis(<Field spies={field} />, backend);

    // the field is a chunk of its own: busy until it is loaded
    expect(screen.getByTestId('upload:attachment').getAttribute('aria-busy')).toBe('true');
    await screen.findByTestId('field:attachment');
    expect(screen.getByTestId('upload:attachment').textContent).toContain('Drop a file here');
    expect(screen.getByTestId('field:attachment')).toHaveProperty('type', 'file');
    choose(BRIEF);
    await waitFor(() => {
      expect(field.onChange).toHaveBeenCalledWith('1');
    });
    expect(backend.calls.find((it) => it.method === 'POST')).toMatchObject({ method: 'POST', url: FILES, body: { file: 'brief.txt' } });
    expect(field.onBusy.mock.calls).toEqual([[true], [false]]);
    expect(field.onError).toHaveBeenCalledWith(null);
    // the file chosen here, from its local copy (a guest reads no uploaded file back): its
    // name and its size, never read from the backend
    await waitFor(() => {
      expect(screen.getByTestId('upload:attachment').getAttribute('aria-busy')).toBeNull();
    });
    expect(screen.getByTestId('upload:attachment').textContent).toContain('brief.txt');
    expect(screen.getByTestId('upload:attachment').textContent).toContain('11 B');
    expect(screen.queryByRole('link')).toBeNull();
    expect(backend.calls.filter((it) => it.method === 'GET')).toEqual([]);
  });

  it('is busy while the file uploads, and the cancel keeps the value', async () => {
    const backend = new Backend()
      .hold('POST', FILES)
      .on('GET', `${FILES}5/`, { data: uploaded(5, 'old.txt') });
    const field = spies();
    renderWithBazis(<Field spies={field} initial="5" />, backend);
    await screen.findByRole('button', { name: 'old.txt' });

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
    expect(await screen.findByRole('button', { name: 'old.txt' })).toBeTruthy();
    expect(field.onChange).not.toHaveBeenCalled();
    expect(field.onBusy.mock.calls).toEqual([[true], [false]]);
  });

  it('takes no other file while one uploads', async () => {
    const backend = new Backend().hold('POST', FILES);
    const field = spies();
    renderWithBazis(<Field spies={field} />, backend);

    choose(BRIEF);
    await waitFor(() => {
      expect(screen.getByTestId('upload:attachment').getAttribute('aria-busy')).toBe('true');
    });
    // a second file, chosen or dropped, while the first one uploads; the drag over is
    // still taken, so the browser does not open the file in the tab
    choose(new File(['other'], 'other.txt'));
    expect(fireEvent.dragOver(screen.getByTestId('upload:attachment'), { dataTransfer: { dropEffect: 'copy' } })).toBe(false);
    fireEvent.drop(screen.getByTestId('upload:attachment'), {
      dataTransfer: { files: [new File(['dropped'], 'dropped.txt')] },
    });
    expect(backend.requests('POST')).toEqual([`POST ${FILES}`]);
    expect(field.onBusy.mock.calls).toEqual([[true]]);
    expect(screen.getByTestId('upload:attachment').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByTestId('upload:attachment').textContent).toContain('brief.txt');

    // once it is cancelled, the field takes a file again
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(field.onBusy.mock.calls).toEqual([[true], [false]]);
    });
    choose(new File(['other'], 'other.txt'));
    await waitFor(() => {
      expect(backend.requests('POST')).toHaveLength(2);
    });
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
    expect(typed.onError).toHaveBeenCalledWith('The file is not of the type images or PDF.');
    expect(backend.calls).toEqual([]);
    expect(large.onBusy).not.toHaveBeenCalled();
  });

  it('names the types that it takes as a user reads them, in the language of the interface', async () => {
    const accept = 'image/jpeg,image/png,image/webp';
    const { unmount } = renderWithBazis(<Field spies={spies()} accept={accept} maxSize={6 * 1024 * 1024} />, new Backend());
    await screen.findByTestId('field:attachment');
    expect(screen.getByTestId('upload:attachment').textContent).toContain('JPEG, PNG, or WebP, up to 6 MB');
    unmount();

    const field = spies();
    renderWithBazis(<Field spies={field} accept={accept} maxSize={6 * 1024 * 1024} />, new Backend(), {
      language: testLanguages('ru'),
    });
    await screen.findByTestId('field:attachment');
    expect(screen.getByTestId('upload:attachment').textContent).toContain('JPEG, PNG или WebP, до 6 МБ');
    expect(screen.getByTestId('upload:attachment').textContent).not.toContain('image/');
    choose(BRIEF);
    expect(field.onError).toHaveBeenCalledWith('Тип файла не подходит: JPEG, PNG или WebP.');
    // the input offers the media types themselves
    expect(screen.getByTestId('field:attachment').getAttribute('accept')).toBe(accept);
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
      .on('GET', `${FILES}1/`, { data: uploaded(1, 'brief.txt') })
      .on('GET', `${FILES}2/`, { data: uploaded(2, 'new.txt') });
    const field = spies();
    renderWithBazis(<Field spies={field} initial="1" />, backend);
    await screen.findByRole('button', { name: 'brief.txt' });
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
    const backend = new Backend().on('GET', `${FILES}1/`, { data: uploaded(1, 'brief.txt') });
    const { unmount } = renderWithBazis(
      <Field spies={spies()} initial="1" field={{ ...FIELD, required: true, nullable: false }} />,
      backend,
    );
    await screen.findByRole('button', { name: 'brief.txt' });
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    unmount();

    renderWithBazis(<Field spies={spies()} initial="1" disabled />, backend);
    await screen.findByRole('button', { name: 'brief.txt' });
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

/** A to-many field of the uploaded files: the ids of the photos in the body of an action. */
const PHOTOS: RelationField = { ...FIELD, name: 'photos', title: 'Photos', nullable: false, many: true };

const PNG = new File(['png'], 'leak.png', { type: 'image/png' });

interface ListSpies {
  onChange: Mock<(value: string[]) => void>;
  onBusy: Mock<(busy: boolean) => void>;
  onError: Mock<(message: string | null) => void>;
}

function listSpies(): ListSpies {
  return { onChange: vi.fn(), onBusy: vi.fn(), onError: vi.fn() };
}

/** The field of several files with its value in a state, as a form holds it. */
function Files({ initial = [], spies: given, ...props }: Partial<FilesFieldProps> & { initial?: string[]; spies: ListSpies }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <FilesField
      field={PHOTOS}
      value={value}
      disabled={false}
      control={{ id: 'photos', 'data-bz': 'field:photos' }}
      path={FILES}
      maxSize={null}
      onChange={(next) => {
        given.onChange(next);
        setValue(next);
      }}
      onBusy={given.onBusy}
      onError={given.onError}
      {...props}
    />
  );
}

function chooseFiles(...files: File[]) {
  fireEvent.change(screen.getByTestId('field:photos'), { target: { files } });
}

/** The local copies of the images (`blob:<n>`), created and dropped. */
function objectUrls() {
  let next = 0;
  const created = vi.fn(() => `blob:${String((next += 1))}`);
  const revoked = vi.fn();
  Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
  return { created, revoked };
}

describe('FilesField', () => {
  it('uploads the chosen files one after the other and takes the ids of their items', async () => {
    const urls = objectUrls();
    const backend = new Backend().each(
      'POST',
      FILES,
      { body: { data: uploaded(1, 'leak.png') }, status: 201 },
      // the id of a guest is a signed token: a text
      { body: { data: { ...uploaded(2, 'brief.txt'), id: '2:1v8Xa:token' } }, status: 201 },
    );
    const field = listSpies();
    renderWithBazis(<Files spies={field} />, backend);
    await screen.findByTestId('field:photos');
    expect(screen.getByTestId('field:photos')).toHaveProperty('multiple', true);
    expect(screen.getByTestId('upload:photos').textContent).toContain('Drop files here');

    chooseFiles(PNG, BRIEF);
    // busy at once, until the last file is uploaded
    expect(screen.getByTestId('upload:photos').getAttribute('aria-busy')).toBe('true');
    await waitFor(() => {
      expect(field.onChange).toHaveBeenLastCalledWith(['1', '2:1v8Xa:token']);
    });
    expect(field.onChange.mock.calls).toEqual([[['1']], [['1', '2:1v8Xa:token']]]);
    expect(backend.calls.map((it) => [it.method, it.body])).toEqual([
      ['POST', { file: 'leak.png' }],
      ['POST', { file: 'brief.txt' }],
    ]);
    expect(field.onBusy.mock.calls).toEqual([[true], [false]]);
    await waitFor(() => {
      expect(screen.getByTestId('upload:photos').getAttribute('aria-busy')).toBeNull();
    });
    // listed from their local copies, the image with its thumbnail: none read from the backend
    expect(screen.getByTestId('file:0').textContent).toContain('leak.png');
    expect(screen.getByTestId('file:0').querySelector('img')?.getAttribute('src')).toBe('blob:1');
    expect(screen.getByTestId('file:1').textContent).toContain('brief.txt');
    expect(urls.created).toHaveBeenCalledTimes(1);
    expect(backend.requests('GET')).toEqual([]);
  });

  it('removes a file before the form is sent, and drops the local copy of its image', async () => {
    const urls = objectUrls();
    const backend = new Backend()
      .each(
        'POST',
        FILES,
        { body: { data: uploaded(1, 'leak.png') }, status: 201 },
        { body: { data: uploaded(2, 'second.png') }, status: 201 },
      )
      .on('GET', `${FILES}5/`, { data: uploaded(5, 'old.txt') });
    const field = listSpies();
    const { unmount } = renderWithBazis(<Files spies={field} initial={['5']} />, backend);
    // a file of the value not chosen here: read with the retrieve of its route set
    expect(await screen.findByRole('button', { name: 'old.txt' })).toBeTruthy();

    chooseFiles(PNG, new File(['png'], 'second.png', { type: 'image/png' }));
    await waitFor(() => {
      expect(field.onBusy).toHaveBeenLastCalledWith(false);
    });
    expect(field.onChange).toHaveBeenLastCalledWith(['5', '1', '2']);
    fireEvent.click(screen.getByTestId('action:remove-file-0'));
    expect(field.onChange).toHaveBeenLastCalledWith(['1', '2']);
    expect(urls.revoked).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('action:remove-file-0'));
    expect(field.onChange).toHaveBeenLastCalledWith(['2']);
    expect(urls.revoked).toHaveBeenCalledWith('blob:1');
    expect(screen.getByTestId('file:0').textContent).toContain('second.png');
    // the others with the field
    unmount();
    expect(urls.revoked.mock.calls).toEqual([['blob:1'], ['blob:2']]);
  });

  it('cancels the file that uploads and leaves out one that waits', async () => {
    const urls = objectUrls();
    const backend = new Backend().hold('POST', FILES);
    const field = listSpies();
    renderWithBazis(<Files spies={field} />, backend);
    await screen.findByTestId('field:photos');

    chooseFiles(BRIEF, PNG);
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeTruthy();
    });
    // the second waits: left out, its local copy dropped
    fireEvent.click(screen.getByTestId('action:remove-file-1'));
    expect(urls.revoked).toHaveBeenCalledWith('blob:1');
    expect(screen.queryByTestId('file:1')).toBeNull();
    // the first uploads: cancelled
    fireEvent.click(screen.getByTestId('action:remove-file-0'));
    await waitFor(() => {
      expect(field.onBusy.mock.calls).toEqual([[true], [false]]);
    });
    expect(screen.queryByTestId('file:0')).toBeNull();
    expect(backend.requests('POST')).toEqual([`POST ${FILES}`]);
    expect(field.onChange).not.toHaveBeenCalled();
  });

  it('sends no file that waits once the form is closed', async () => {
    objectUrls();
    const backend = new Backend().hold('POST', FILES);
    const field = listSpies();
    const { unmount } = renderWithBazis(<Files spies={field} />, backend);
    await screen.findByTestId('field:photos');

    chooseFiles(BRIEF, PNG);
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeTruthy();
    });
    // the upload of the first is aborted with the field, the second never sent
    unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(backend.requests('POST')).toEqual([`POST ${FILES}`]);
    expect(field.onChange).not.toHaveBeenCalled();
  });

  it('does not send the files larger than the limit or of another type, and takes the others', async () => {
    objectUrls();
    const backend = new Backend().each('POST', FILES, { body: { data: uploaded(1, 'leak.png') }, status: 201 });
    const field = listSpies();
    renderWithBazis(<Files spies={field} maxSize={5} accept="image/png,image/webp" />, backend);
    await screen.findByTestId('field:photos');
    expect(screen.getByTestId('field:photos').getAttribute('accept')).toBe('image/png,image/webp');
    expect(screen.getByTestId('upload:photos').textContent).toContain('up to 5 B');

    chooseFiles(BRIEF, PNG);
    expect(field.onError).toHaveBeenCalledWith('The file is larger than 5 B.');
    await waitFor(() => {
      expect(field.onChange).toHaveBeenCalledWith(['1']);
    });
    chooseFiles(new File(['gif'], 'cat.gif', { type: 'image/gif' }));
    expect(field.onError).toHaveBeenLastCalledWith('The file is not of the type PNG or WebP.');
    expect(backend.calls.map((it) => it.body)).toEqual([{ file: 'leak.png' }]);
  });

  it('takes at most the files of maxItems, the others never sent, and more once one is removed', async () => {
    objectUrls();
    const backend = new Backend().each(
      'POST',
      FILES,
      { body: { data: uploaded(1, 'a.png') }, status: 201 },
      { body: { data: uploaded(2, 'b.png') }, status: 201 },
      { body: { data: uploaded(3, 'd.png') }, status: 201 },
    );
    const field = listSpies();
    renderWithBazis(<Files spies={field} field={{ ...PHOTOS, maxItems: 2 }} />, backend);
    await screen.findByTestId('field:photos');
    expect(screen.getByTestId('upload:photos').textContent).toContain('up to 2 files');

    const png = (name: string) => new File(['png'], name, { type: 'image/png' });
    chooseFiles(png('a.png'), png('b.png'), png('c.png'));
    expect(field.onError).toHaveBeenLastCalledWith('At most 2 files.');
    await waitFor(() => {
      expect(field.onChange).toHaveBeenLastCalledWith(['1', '2']);
    });
    // full: nothing more is sent
    chooseFiles(png('d.png'));
    expect(field.onError).toHaveBeenLastCalledWith('At most 2 files.');
    expect(backend.calls.map((it) => it.body)).toEqual([{ file: 'a.png' }, { file: 'b.png' }]);

    fireEvent.click(screen.getByTestId('action:remove-file-0'));
    chooseFiles(png('d.png'));
    expect(field.onError).toHaveBeenLastCalledWith(null);
    await waitFor(() => {
      expect(field.onChange).toHaveBeenLastCalledWith(['2', '3']);
    });
    expect(backend.calls.map((it) => it.body)).toEqual([{ file: 'a.png' }, { file: 'b.png' }, { file: 'd.png' }]);
  });

  it('counts the files that upload or wait in maxItems', async () => {
    objectUrls();
    const backend = new Backend().hold('POST', FILES);
    const field = listSpies();
    renderWithBazis(<Files spies={field} field={{ ...PHOTOS, maxItems: 2 }} />, backend);
    await screen.findByTestId('field:photos');

    const png = (name: string) => new File(['png'], name, { type: 'image/png' });
    chooseFiles(png('a.png'));
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeTruthy();
    });
    // a.png uploads: room for one more, which waits
    chooseFiles(png('b.png'), png('c.png'));
    expect(field.onError).toHaveBeenLastCalledWith('At most 2 files.');
    expect(screen.getByTestId('file:1').textContent).toContain('b.png');
    expect(screen.queryByTestId('file:2')).toBeNull();
    // a.png uploads, b.png waits: no room
    chooseFiles(png('d.png'));
    expect(field.onError).toHaveBeenLastCalledWith('At most 2 files.');
    expect(screen.queryByTestId('file:2')).toBeNull();
  });

  it.each([
    ['the type that the content shows', 422, 'ERR_FILE_TYPE', 'The file is not an image of the allowed types'],
    ['the size limit', 413, 'ERR_FILE_TOO_LARGE', 'The file is larger than 6291456 bytes'],
    ['the rate of the guests', 429, 'ERR_THROTTLED', 'Too many requests, retry in 60 seconds'],
    ['anonymous uploads turned off', 401, 'UNAUTHORIZED', 'Not authenticated'],
  ])('leaves out a file that the backend refuses: %s', async (_, status, code, detail) => {
    objectUrls();
    const backend = new Backend().each(
      'POST',
      FILES,
      { body: { errors: [{ status, code, detail }] }, status },
      { body: { data: uploaded(2, 'brief.txt') }, status: 201 },
    );
    const field = listSpies();
    renderWithBazis(<Files spies={field} />, backend);
    await screen.findByTestId('field:photos');
    chooseFiles(PNG, BRIEF);
    await waitFor(() => {
      expect(field.onBusy).toHaveBeenLastCalledWith(false);
    });
    expect(field.onError).toHaveBeenCalledWith(detail);
    // the next file is uploaded
    expect(field.onChange.mock.calls).toEqual([[['2']]]);
    expect(screen.getByTestId('file:0').textContent).toContain('brief.txt');
    expect(screen.queryByTestId('file:1')).toBeNull();
  });

  it('says that the upload failed when the backend cannot be reached', async () => {
    const backend = new Backend().unreachable('POST', FILES);
    const field = listSpies();
    renderWithBazis(<Files spies={field} />, backend);
    await screen.findByTestId('field:photos');
    chooseFiles(BRIEF);
    await waitFor(() => {
      expect(field.onError).toHaveBeenLastCalledWith('The upload failed.');
    });
    expect(field.onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('file:0')).toBeNull();
  });

  it('shows a name as a text, however long', async () => {
    const backend = new Backend().each(
      'POST',
      FILES,
      { body: { data: uploaded(1, 'x.txt') }, status: 201 },
      { body: { data: uploaded(2, 'y.txt') }, status: 201 },
    );
    const field = listSpies();
    renderWithBazis(<Files spies={field} />, backend);
    await screen.findByTestId('field:photos');
    const markup = '<img src=x onerror="window.injected=1">.txt';
    const long = `${'a'.repeat(5000)}.txt`;
    chooseFiles(new File(['x'], markup), new File(['x'], long));
    await waitFor(() => {
      expect(field.onBusy).toHaveBeenLastCalledWith(false);
    });
    const first = screen.getByTestId('file:0');
    expect(first.textContent).toContain(markup);
    expect(first.querySelector('img')).toBeNull();
    // cut to the width of the field, the whole name as its title
    const name = screen.getByTitle(long);
    expect(name.className).toContain('truncate');
  });

  it('changes nothing when disabled', async () => {
    const backend = new Backend().on('GET', `${FILES}5/`, { data: uploaded(5, 'old.txt') });
    const field = listSpies();
    renderWithBazis(<Files spies={field} initial={['5']} disabled />, backend);
    await screen.findByRole('button', { name: 'old.txt' });
    expect(screen.getByTestId('field:photos')).toHaveProperty('disabled', true);
    expect(screen.queryByTestId('action:remove-file-0')).toBeNull();
    chooseFiles(BRIEF);
    expect(backend.requests('POST')).toEqual([]);
  });
});

describe('FileFieldProvider of several files', () => {
  it('makes FilesField the control of a to-many file field of FieldInput, with its errors as error:<name>', async () => {
    const backend = new Backend();
    const onChange = vi.fn();
    renderWithBazis(
      <FileFieldProvider resources={['test.file']} accept={{ photos: '.txt' }}>
        <FieldInput field={PHOTOS} value={[]} onChange={onChange} />
      </FileFieldProvider>,
      backend,
    );
    expect(await screen.findByLabelText('Photos')).toBe(screen.getByTestId('field:photos'));
    expect(screen.getByTestId('field:photos').getAttribute('accept')).toBe('.txt');
    act(() => {
      chooseFiles(PNG);
    });
    expect(screen.getByTestId('error:photos').textContent).toBe('The file is not of the type TXT.');
    expect(onChange).not.toHaveBeenCalled();
    expect(backend.calls).toEqual([]);
  });

  it('gives a guest the types that the guests upload, whatever accept says', async () => {
    renderWithBazis(
      <FileFieldProvider resources={['test.file']} accept={{ photos: '.txt', attachment: '.txt' }} guest>
        <FieldInput field={PHOTOS} value={[]} onChange={vi.fn()} />
        <FieldInput field={FIELD} value={null} onChange={vi.fn()} />
      </FileFieldProvider>,
      new Backend(),
    );
    await screen.findByTestId('field:photos');
    await screen.findByTestId('field:attachment');
    // `anonymous_types` of the contract; any type when the guests upload none
    expect(screen.getByTestId('field:photos').getAttribute('accept')).toBe(ANONYMOUS_ACCEPT ?? null);
    expect(screen.getByTestId('field:attachment').getAttribute('accept')).toBe(ANONYMOUS_ACCEPT ?? null);
  });
});

/**
 * The images of the tests, which jsdom does not draw: `createImageBitmap` gives an image of
 * these sides (or fails, `undecoded`), a canvas a blob of a byte for each 1000 pixels.
 */
function images({ width = 4000, height = 3000, undecoded = false } = {}) {
  const close = vi.fn();
  const decode = vi.fn(() => (undecoded ? Promise.reject(new Error('HEIC')) : Promise.resolve({ width, height, close })));
  vi.stubGlobal('createImageBitmap', decode);
  const drawImage = vi.fn();
  const sizes: [number, number][] = [];
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as never;
  HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, done: BlobCallback, type?: string) {
    sizes.push([this.width, this.height]);
    done(new Blob([new Uint8Array(Math.round((this.width * this.height) / 1000))], { type }));
  };
  return { decode, close, sizes };
}

/** A file of these bytes. */
const sized = (bytes: number, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });

describe('fitImage', () => {
  it('reduces an image larger than the limit until it fits, turned as its EXIF says', async () => {
    const image = images();
    const photo = sized(9000, 'photo.jpg', 'image/jpeg');
    const fitted = await fitImage(photo, 8000);
    // at its size (12000 bytes), then its sides by 0.8 (7680 bytes)
    expect(image.sizes).toEqual([
      [4000, 3000],
      [3200, 2400],
    ]);
    expect([fitted?.name, fitted?.type, fitted?.size]).toEqual(['photo.jpg', 'image/jpeg', 7680]);
    expect(image.decode).toHaveBeenCalledWith(photo, { imageOrientation: 'from-image' });
    expect(image.close).toHaveBeenCalled();
  });

  it('keeps a PNG a PNG and draws another image as a JPEG', async () => {
    images();
    const png = await fitImage(sized(20000, 'plan.png', 'image/png'), 12000);
    expect([png?.name, png?.type]).toEqual(['plan.png', 'image/png']);
    const heic = await fitImage(sized(20000, 'IMG_1.heic', 'image/heic'), 12000);
    expect([heic?.name, heic?.type]).toEqual(['IMG_1.jpg', 'image/jpeg']);
  });

  it('gives the file itself within the limit, and nothing for a file that it does not reduce', async () => {
    const image = images();
    const brief = sized(9000, 'brief.pdf', 'application/pdf');
    expect(await fitImage(brief, 9000)).toBe(brief);
    expect(await fitImage(brief, null)).toBe(brief);
    expect(await fitImage(brief, 8000)).toBeNull();
    expect(await fitImage(sized(9000, 'cat.gif', 'image/gif'), 8000)).toBeNull();
    expect(await fitImage(sized(9000, 'logo.svg', 'image/svg+xml'), 8000)).toBeNull();
    expect(image.decode).not.toHaveBeenCalled();
    // an image that the browser does not decode
    images({ undecoded: true });
    expect(await fitImage(sized(9000, 'IMG_1.heic', 'image/heic'), 8000)).toBeNull();
  });

  it('draws the long side of the image never under 1024 pixels, in four tries at most', async () => {
    const small = images({ width: 1200, height: 900 });
    expect(await fitImage(sized(9000, 'photo.jpg', 'image/jpeg'), 10)).toBeNull();
    expect(small.sizes).toEqual([
      [1200, 900],
      [1024, 768],
    ]);
    const large = images({ width: 8000, height: 6000 });
    expect(await fitImage(sized(90000, 'photo.jpg', 'image/jpeg'), 10)).toBeNull();
    expect(large.sizes.map(([width]) => width)).toEqual([8000, 6400, 5120, 4096]);
  });
});

describe('the images larger than the limit', () => {
  it('are reduced to it before FileField uploads them', async () => {
    objectUrls();
    images();
    const backend = new Backend().on('POST', FILES, { data: uploaded(1, 'photo.jpg', 7680) }, 201);
    const field = spies();
    renderWithBazis(<Field spies={field} maxSize={8000} />, backend);
    await screen.findByTestId('field:attachment');
    expect(screen.getByTestId('upload:attachment').textContent).toContain('up to 7.8 KB, a larger image reduced to it');
    choose(sized(9000, 'photo.jpg', 'image/jpeg'));
    await waitFor(() => {
      expect(field.onChange).toHaveBeenCalledWith('1');
    });
    // the reduced image, shown with its size
    expect(screen.getByTestId('upload:attachment').textContent).toContain('7.5 KB');
    expect(field.onError.mock.calls).toEqual([[null]]);
    expect(field.onBusy.mock.calls).toEqual([[true], [false]]);
  });

  it('are refused when they do not fit, and a field of other files says nothing of them', async () => {
    images({ width: 1200, height: 900 });
    const backend = new Backend();
    const field = spies();
    const { unmount } = renderWithBazis(<Field spies={field} maxSize={10} accept=".pdf" />, backend);
    await screen.findByTestId('field:attachment');
    expect(screen.getByTestId('upload:attachment').textContent).toContain('PDF, up to 10 B');
    expect(screen.getByTestId('upload:attachment').textContent).not.toContain('reduced');
    choose(sized(9000, 'photo.jpg', 'image/jpeg'));
    expect(field.onError).toHaveBeenCalledWith('The file is not of the type PDF.');
    choose(sized(9000, 'brief.pdf', 'application/pdf'));
    expect(field.onError).toHaveBeenLastCalledWith('The file is larger than 10 B.');
    unmount();
    renderWithBazis(<Field spies={field} maxSize={10} />, backend);
    await screen.findByTestId('field:attachment');
    choose(sized(9000, 'photo.jpg', 'image/jpeg'));
    await waitFor(() => {
      expect(field.onError).toHaveBeenLastCalledWith('The file is larger than 10 B.');
    });
    expect(backend.calls).toEqual([]);
  });

  it('are not uploaded by a FileField closed while they are reduced', async () => {
    const image = images();
    let decoded = (): void => undefined;
    image.decode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          decoded = () => {
            resolve({ width: 4000, height: 3000, close: image.close });
          };
        }),
    );
    const backend = new Backend();
    const field = spies();
    const { unmount } = renderWithBazis(<Field spies={field} maxSize={8000} />, backend);
    await screen.findByTestId('field:attachment');
    choose(sized(9000, 'photo.jpg', 'image/jpeg'));
    unmount();
    decoded();
    await waitFor(() => {
      expect(image.close).toHaveBeenCalled();
    });
    expect(backend.calls).toEqual([]);
    expect(field.onChange).not.toHaveBeenCalled();
  });

  it('are reduced as FilesField uploads them, one cancelled meanwhile left out', async () => {
    objectUrls();
    const image = images();
    // the first image decodes once the test lets it
    let decoded = (): void => undefined;
    image.decode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          decoded = () => {
            resolve({ width: 4000, height: 3000, close: image.close });
          };
        }),
    );
    const backend = new Backend().each('POST', FILES, { body: { data: uploaded(2, 'second.png') }, status: 201 });
    const field = listSpies();
    renderWithBazis(<Files spies={field} maxSize={8000} />, backend);
    await screen.findByTestId('field:photos');
    chooseFiles(sized(9000, 'first.jpg', 'image/jpeg'), sized(9000, 'second.png', 'image/png'));
    // the first is reduced: still waiting, cancelled
    fireEvent.click(screen.getByTestId('action:remove-file-0'));
    act(() => {
      decoded();
    });
    await waitFor(() => {
      expect(field.onChange).toHaveBeenCalledWith(['2']);
    });
    expect(backend.calls.map((it) => it.body)).toEqual([{ file: 'second.png' }]);
    expect(screen.getByTestId('file:0').textContent).toContain('7.5 KB');
  });
});
