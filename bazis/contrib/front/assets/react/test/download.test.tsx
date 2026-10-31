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

import { focusManager } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, saveFile } from '@/bazis/client';

import { useActionFile, useDownload, useDownloadUrl, useList, type SavedFile } from '../src/index.js';
import { Backend, PARENT, render } from './support.js';

const DOWNLOAD = `${PARENT}7/download/`;

// jsdom has no object URLs
const createObjectURL = vi.fn((blob: Blob) => `blob:${String(blob.size)}`);
const revokeObjectURL = vi.fn();
const clicked: { href: string; download: string; attached: boolean }[] = [];

beforeEach(() => {
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  clicked.length = 0;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.href, download: this.download, attached: this.isConnected });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

describe('saveFile', () => {
  it('saves the file through a link to its URL, revoked later', () => {
    vi.useFakeTimers();
    const blob = new Blob(['x']);
    saveFile({ blob, name: null }, 'export.xlsx');
    saveFile({ blob, name: 'brief.txt' });
    expect(clicked).toEqual([
      { href: 'blob:1', download: 'export.xlsx', attached: true },
      { href: 'blob:1', download: 'brief.txt', attached: true },
    ]);
    expect(document.querySelector('a')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});

describe('useDownload', () => {
  it('reads the file of an item from its download route and saves it under its name', async () => {
    const backend = new Backend().file(DOWNLOAD, 'report', 'attachment; filename="report.xlsx"');
    const { result } = render(() => useDownload(PARENT), backend);
    let name: string | null = null;
    await act(async () => {
      name = await result.current.mutateAsync('7');
    });
    expect(backend.requests()).toEqual([`GET ${DOWNLOAD}`]);
    expect(clicked).toEqual([{ href: 'blob:6', download: 'report.xlsx', attached: true }]);
    // the name of the file, not its content, is kept in the state of the mutation
    expect(name).toBe('report.xlsx');
    await waitFor(() => {
      expect(result.current.data).toBe('report.xlsx');
    });
  });

  it('gives the error of the backend and saves nothing', async () => {
    const backend = new Backend().on('GET', DOWNLOAD, { errors: [{ status: 404, detail: 'Item not found' }] }, 404);
    const { result } = render(() => useDownload(PARENT), backend);
    act(() => {
      result.current.mutate('7');
    });
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
    expect(clicked).toEqual([]);
  });
});

describe('useActionFile', () => {
  const CSV = `${PARENT}csv/`;

  it('posts the body, saves the file of the answer under its name and refetches the resource', async () => {
    const backend = new Backend()
      .on('GET', PARENT, { data: [], links: {}, meta: {} })
      .file(CSV, 'title', 'attachment; filename="tasks.csv"', 'POST', { 'X-Bazis-Meta': '{"count":3}' });
    const { result } = render(() => ({ list: useList(PARENT), file: useActionFile(PARENT, 'csv') }), backend);
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    backend.calls.length = 0;
    let saved: SavedFile | undefined;
    await act(async () => {
      saved = await result.current.file.mutateAsync({ priority: 'high' });
    });
    expect(backend.calls[0]).toMatchObject({ method: 'POST', body: { priority: 'high' } });
    expect(backend.requests()).toEqual([`POST ${CSV}`, `GET ${PARENT}`]);
    expect(clicked).toEqual([{ href: 'blob:5', download: 'tasks.csv', attached: true }]);
    // the meta of the file next to its name
    expect(saved).toEqual({ name: 'tasks.csv', meta: { count: 3 } });
  });

  it('saves a file without a name under the name of the action', async () => {
    const backend = new Backend().file(CSV, 'title', 'attachment', 'POST');
    const { result } = render(() => useActionFile(PARENT, 'csv'), backend);
    let saved: SavedFile | undefined;
    await act(async () => {
      saved = await result.current.mutateAsync({});
    });
    expect(clicked).toEqual([{ href: 'blob:5', download: 'csv', attached: true }]);
    expect(saved).toEqual({ name: 'csv', meta: null });
  });

  it('gives the errors of the body by field and saves nothing', async () => {
    const errors = [{ status: 422, code: 'ERR_VALIDATE', detail: 'Input should be low or high', source: { pointer: '/priority' } }];
    const backend = new Backend().on('POST', CSV, { errors }, 422);
    const { result } = render(() => useActionFile(PARENT, 'csv'), backend);
    act(() => {
      result.current.mutate({ priority: null });
    });
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
    expect(result.current.errors).toEqual({ priority: ['Input should be low or high'] });
    expect(clicked).toEqual([]);
  });
});

describe('useDownloadUrl', () => {
  it('reads the content while an id is given, as an object URL revoked when it is left', async () => {
    const backend = new Backend().file(DOWNLOAD, 'png', 'inline; filename="photo.png"');
    const { result, rerender, unmount, queryClient } = render(
      ({ id }: { id: string | null }) => useDownloadUrl(PARENT, id),
      backend,
      undefined,
      { id: null as string | null },
    );
    expect(result.current).toBeNull();
    expect(backend.requests()).toEqual([]);
    rerender({ id: '7' });
    await waitFor(() => {
      expect(result.current).toBe('blob:3');
    });
    // read once: neither an invalidation of the hooks nor the focus of the window reads it again
    expect(queryClient.getQueryCache().getAll().map((query) => query.queryKey)).toContainEqual(
      ['bazis-files', PARENT, '7', 's1'],
    );
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['bazis'] });
      await queryClient.invalidateQueries({ queryKey: ['bazis', PARENT] });
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await queryClient.refetchQueries({ stale: true, type: 'active' });
    });
    expect(backend.requests()).toEqual([`GET ${DOWNLOAD}`]);
    rerender({ id: null });
    expect(result.current).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:3');
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
