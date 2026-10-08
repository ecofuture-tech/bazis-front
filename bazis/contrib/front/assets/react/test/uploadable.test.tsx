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

import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '@/bazis/client';

import { useList } from '../src/index.js';
import { useUpload } from '../src/uploadable/index.js';
import { Backend, PARENT, render } from './support.js';

// the upload is the create of its route set: the route set of the fixture stands for one of
// bazis-uploadable
const FILES = PARENT;

/** The XMLHttpRequests of the client: each records its request and answers when told. */
class Requests {
  readonly sent: FakeXhr[] = [];
  readonly create = () => {
    const xhr = new FakeXhr();
    this.sent.push(xhr);
    return xhr as unknown as XMLHttpRequest;
  };
}

class FakeXhr {
  url = '';
  body: FormData | null = null;
  status = 0;
  statusText = '';
  responseText = '';
  aborted = false;
  upload: { onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader() {
    // the headers are checked by the tests of the client
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}

const FILE = new File(['hello world'], 'brief.txt', { type: 'text/plain' });
const CREATED = {
  data: { id: 1, type: 'uploadable.file_upload', attributes: { file: '/media/brief.txt', name: 'brief.txt', size: 11 } },
};

function setup() {
  const backend = new Backend().on('GET', FILES, { data: [] });
  const requests = new Requests();
  backend.xhr = requests.create;
  return { backend, requests };
}

describe('useUpload', () => {
  it('uploads a file with its progress and refetches the route set', async () => {
    const { backend, requests } = setup();
    const { result } = render(() => ({ upload: useUpload(FILES), list: useList(FILES) }), backend);
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    expect(result.current.upload.status).toBe('idle');

    let uploaded: Promise<unknown> = Promise.resolve();
    act(() => {
      uploaded = result.current.upload.upload(FILE, { name: 'Brief.txt' });
    });
    await waitFor(() => {
      expect(requests.sent).toHaveLength(1);
    });
    const [xhr] = requests.sent;
    expect(xhr?.body?.get('name')).toBe('Brief.txt');
    expect(result.current.upload.status).toBe('uploading');
    expect(result.current.upload.progress).toEqual({ loaded: 0, total: 11 });

    act(() => {
      xhr?.upload.onprogress?.({ loaded: 6, total: 11, lengthComputable: true });
    });
    expect(result.current.upload.progress).toEqual({ loaded: 6, total: 11 });

    await act(async () => {
      xhr?.respond(201, CREATED);
      await expect(uploaded).resolves.toEqual(CREATED);
    });
    expect(result.current.upload.status).toBe('success');
    expect(result.current.upload.progress).toBeNull();
    expect(result.current.upload.data).toEqual(CREATED);
    // the list of the route set is read again
    await waitFor(() => {
      expect(backend.requests('GET')).toEqual([`GET ${FILES}`, `GET ${FILES}`]);
    });
  });

  it('keeps the error of the backend', async () => {
    const { backend, requests } = setup();
    const { result } = render(() => useUpload(FILES), backend);
    let uploaded: Promise<unknown> = Promise.resolve();
    act(() => {
      uploaded = result.current.upload(FILE).catch((error: unknown) => error);
    });
    await waitFor(() => {
      expect(requests.sent).toHaveLength(1);
    });
    await act(async () => {
      requests.sent[0]?.respond(413, { errors: [{ status: 413, code: 'ERR_FILE_TOO_LARGE', detail: 'Too large' }] });
      expect(await uploaded).toBeInstanceOf(ApiError);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatchObject({ status: 413, message: 'Too large' });
    act(() => {
      result.current.reset();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });
  });

  it('aborts the upload: no error, back to idle', async () => {
    const { backend, requests } = setup();
    const { result } = render(() => useUpload(FILES), backend);
    let uploaded: Promise<unknown> = Promise.resolve();
    act(() => {
      uploaded = result.current.upload(FILE);
    });
    await waitFor(() => {
      expect(requests.sent).toHaveLength(1);
    });
    await act(async () => {
      result.current.abort();
      await expect(uploaded).resolves.toBeNull();
    });
    expect(requests.sent[0]?.aborted).toBe(true);
    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });
    expect(result.current.error).toBeNull();
  });

  it('aborts the upload running when another one starts', async () => {
    const { backend, requests } = setup();
    const { result } = render(() => useUpload(FILES), backend);
    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.upload(FILE);
    });
    await waitFor(() => {
      expect(requests.sent).toHaveLength(1);
    });
    act(() => {
      second = result.current.upload(new File(['x'], 'other.txt'));
    });
    await waitFor(() => {
      expect(requests.sent).toHaveLength(2);
    });
    await expect(first).resolves.toBeNull();
    expect(requests.sent[0]?.aborted).toBe(true);
    expect(result.current.status).toBe('uploading');
    await act(async () => {
      requests.sent[1]?.respond(201, CREATED);
      await expect(second).resolves.toEqual(CREATED);
    });
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
  });
});
