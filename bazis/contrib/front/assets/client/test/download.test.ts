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

import { ApiError, createClient, dispositionName, fileMeta, type DownloadedFile } from '../src/index.js';
import { BASE, recordingFetch } from './support.js';

const FILES = '/api/v1/uploadable/file_upload/';

function setup(response: Response, token?: string) {
  const { fetch, calls } = recordingFetch([response]);
  // the route sets of the fixture have no download route: the paths are plain strings here
  const api = createClient({ baseUrl: BASE, fetch, token, language: 'ru' }) as unknown as {
    download: (path: string, id: string, options?: { signal?: AbortSignal }) => Promise<DownloadedFile>;
    actionFile: (path: string, name: string, body?: unknown) => Promise<DownloadedFile>;
  };
  return { api, calls };
}

describe('download', () => {
  it('reads the file of an item with the token and the name of Content-Disposition', async () => {
    const response = new Response('PDF', {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': "attachment; filename*=utf-8''%D0%B1%D0%B5%D0%B9%D0%B4%D0%B6.pdf" },
    });
    const { api, calls } = setup(response, 'jwt');
    const file = await api.download(FILES, 'a/1');
    expect(file.name).toBe('бейдж.pdf');
    expect(file.meta).toBeNull();
    expect(await file.blob.text()).toBe('PDF');
    // no Accept of JSON:API: the response is the file; the language as on every request
    expect(calls).toEqual([
      { url: `${BASE}${FILES}a%2F1/download/`, init: { headers: { 'Accept-Language': 'ru', Authorization: 'Bearer jwt' } } },
    ]);
  });

  it('rejects with the ApiError of the backend', async () => {
    const body = JSON.stringify({ errors: [{ status: 404, detail: 'Item not found' }] });
    const { api } = setup(new Response(body, { status: 404 }));
    const error = await api.download(FILES, '2').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });
});

describe('actionFile', () => {
  const TASKS = '/api/v1/tasks/task/';

  it('posts the JSON body of a custom action and reads the file of its answer', async () => {
    const response = new Response('title\r\nPlan\r\n', {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="tasks.csv"' },
    });
    const { api, calls } = setup(response, 'jwt');
    const file = await api.actionFile(TASKS, 'export', { priority: 'high' });
    expect(file.name).toBe('tasks.csv');
    expect(await file.blob.text()).toBe('title\r\nPlan\r\n');
    expect(calls).toEqual([
      {
        url: `${BASE}${TASKS}export/`,
        init: {
          method: 'POST',
          headers: { 'Accept-Language': 'ru', Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
          body: '{"priority":"high"}',
        },
      },
    ]);
  });

  it('reads the meta of the file, the JSON object of X-Bazis-Meta', async () => {
    const response = new Response('title\r\nPlan\r\n', {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="tasks.csv"', 'X-Bazis-Meta': '{"count":1,"total":"4.50"}' },
    });
    const { api } = setup(response);
    const file = await api.actionFile(TASKS, 'export', {});
    expect(file).toMatchObject({ name: 'tasks.csv', meta: { count: 1, total: '4.50' } });
  });

  it('rejects with the ApiError of the backend, the errors of the body at its fields', async () => {
    const errors = [{ status: 422, code: 'ERR_VALIDATE', detail: 'Input should be high or low', source: { pointer: '/priority' } }];
    const { api } = setup(new Response(JSON.stringify({ errors }), { status: 422 }));
    const error = await api.actionFile(TASKS, 'export', { priority: 'urgent' }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).bodyErrors()).toEqual({ priority: ['Input should be high or low'] });
  });
});

describe('fileMeta', () => {
  it('reads the JSON object of the header, null without it', () => {
    expect(fileMeta('{"count":2}')).toEqual({ count: 2 });
    expect(fileMeta(null)).toBeNull();
  });

  it.each(['count=2', '[1]', '2', 'null'])('warns of %j, which is not a JSON object', (header) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(fileMeta(header)).toBeNull();
    expect(warn).toHaveBeenCalledWith(`The header X-Bazis-Meta of the file is not a JSON object: ${header}`);
    warn.mockRestore();
  });
});

describe('dispositionName', () => {
  it.each([
    ['attachment; filename="brief.txt"', 'brief.txt'],
    ['inline; filename="a \\"quoted\\" name.png"', 'a "quoted" name.png'],
    ['attachment; filename=plain.csv', 'plain.csv'],
    // the encoded name of a name that is not ASCII wins
    ["attachment; filename=\"fallback.pdf\"; filename*=UTF-8''%C3%A9t%C3%A9.pdf", 'été.pdf'],
    ["attachment; filename*=utf-8''%E0%A4%A", null],
    ['attachment', null],
    [null, null],
  ])('reads the name of %j', (header, name) => {
    expect(dispositionName(header)).toBe(name);
  });
});
