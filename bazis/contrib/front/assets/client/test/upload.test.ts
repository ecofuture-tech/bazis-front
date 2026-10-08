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

import { describe, expect, it, vi } from 'vitest';

import { ApiError, createClient } from '../src/index.js';
import type { paths } from './fixtures/schema.js';

const BASE = 'https://api.test';
// a route set with a create: the upload of bazis-uploadable is the create of its route set
const FILES = '/api/v1/entity/parent_entity/';

/** An XMLHttpRequest that records what is sent and answers when the test says so. */
class FakeXhr {
  method = '';
  url = '';
  headers: Record<string, string> = {};
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

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: FormData) {
    this.body = body;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.({ loaded, total, lengthComputable });
  }

  respond(status: number, body: unknown, statusText = '') {
    this.status = status;
    this.statusText = statusText;
    this.responseText = body === undefined ? '' : JSON.stringify(body);
    this.onload?.();
  }
}

function setup(token: string | null = 'jwt') {
  const xhr = new FakeXhr();
  const fetch = vi.fn();
  const api = createClient<paths>({
    baseUrl: BASE,
    token: () => token,
    fetch,
    xhr: () => xhr as unknown as XMLHttpRequest,
  });
  return { api, xhr, fetch };
}

/** Lets the client open the request: it reads the token first. */
const opened = () => new Promise((resolve) => setTimeout(resolve, 0));

const FILE = new File(['hello world'], 'brief.txt', { type: 'text/plain' });
const CREATED = {
  data: {
    id: 1,
    type: 'uploadable.file_upload',
    attributes: { file: '/media/files/fileupload/brief.txt', name: 'brief.txt', extension: 'txt', size: 11 },
  },
};

describe('upload', () => {
  it('posts the file as multipart form data with the token and reports the progress', async () => {
    const { api, xhr, fetch } = setup();
    const progress = vi.fn();
    const uploading = api.upload(FILES, FILE, { onProgress: progress });
    await opened();
    expect([xhr.method, xhr.url]).toEqual(['POST', `${BASE}${FILES}`]);
    expect(xhr.headers).toEqual({ Accept: 'application/vnd.api+json, application/json', Authorization: 'Bearer jwt' });
    // the browser sets the content type with the boundary of the body
    expect(xhr.headers['Content-Type']).toBeUndefined();
    expect(xhr.body?.get('file')).toBeInstanceOf(File);
    expect((xhr.body?.get('file') as File).name).toBe('brief.txt');
    expect(xhr.body?.has('name')).toBe(false);

    xhr.progress(4, 11);
    xhr.progress(11, 0, false);
    expect(progress.mock.calls).toEqual([[{ loaded: 4, total: 11 }], [{ loaded: 11, total: 11 }]]);
    xhr.respond(201, CREATED);
    await expect(uploading).resolves.toEqual(CREATED);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the name of the file and no token without a session', async () => {
    const { api, xhr } = setup(null);
    const uploading = api.upload(FILES, FILE, { name: 'Report.txt' });
    await opened();
    expect(xhr.body?.get('name')).toBe('Report.txt');
    expect(xhr.headers.Authorization).toBeUndefined();
    xhr.respond(201, CREATED);
    await uploading;
  });

  it('rejects a file too large with the ApiError of the backend', async () => {
    const { api, xhr } = setup();
    const uploading = api.upload(FILES, FILE).catch((error: unknown) => error);
    await opened();
    xhr.respond(413, {
      errors: [{ status: 413, code: 'ERR_FILE_TOO_LARGE', title: 'File too large', detail: 'The file is larger than 10 bytes' }],
    });
    const error = await uploading;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 413, message: 'The file is larger than 10 bytes' });
    expect((error as ApiError).errors[0]?.code).toBe('ERR_FILE_TOO_LARGE');
  });

  it('rejects a response that is not JSON with its status', async () => {
    const { api, xhr } = setup();
    const uploading = api.upload(FILES, FILE).catch((error: unknown) => error);
    await opened();
    xhr.status = 413;
    xhr.statusText = 'Request Entity Too Large';
    xhr.responseText = '<html>nginx</html>';
    xhr.onload?.();
    expect(await uploading).toMatchObject({ status: 413, message: 'Request Entity Too Large' });
  });

  it('rejects a successful response that is not JSON', async () => {
    const { api, xhr } = setup();
    const uploading = api.upload(FILES, FILE).catch((error: unknown) => error);
    await opened();
    xhr.status = 200;
    xhr.responseText = '<html>a proxy</html>';
    xhr.onload?.();
    const error = await uploading;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 200, message: 'The response of the upload is not JSON.' });
  });

  it('rejects a network error', async () => {
    const { api, xhr } = setup();
    const uploading = api.upload(FILES, FILE).catch((error: unknown) => error);
    await opened();
    xhr.onerror?.();
    expect(await uploading).toBeInstanceOf(TypeError);
  });

  it('aborts the request with the signal', async () => {
    const { api, xhr } = setup();
    const controller = new AbortController();
    const uploading = api.upload(FILES, FILE, { signal: controller.signal }).catch((error: unknown) => error);
    await opened();
    controller.abort();
    expect(xhr.aborted).toBe(true);
    expect(await uploading).toMatchObject({ name: 'AbortError' });
  });

  it('does not send a request already aborted', async () => {
    const { api, xhr } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(api.upload(FILES, FILE, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(xhr.method).toBe('');
  });
});
