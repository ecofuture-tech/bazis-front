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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, saveFile } from '@/bazis/client';

import { useDownload, useDownloadUrl } from '../src/index.js';
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
    await act(async () => {
      await result.current.mutateAsync('7');
    });
    expect(backend.requests()).toEqual([`GET ${DOWNLOAD}`]);
    expect(clicked).toEqual([{ href: 'blob:6', download: 'report.xlsx', attached: true }]);
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
    // keyed under the item: a change of the resource reads it again
    expect(queryClient.getQueryCache().getAll().map((query) => query.queryKey)).toContainEqual(
      ['bazis', PARENT, 'item', '7', 'action', 'download', 's1'],
    );
    rerender({ id: null });
    expect(result.current).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:3');
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
