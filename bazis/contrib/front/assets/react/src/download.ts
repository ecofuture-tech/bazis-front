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

import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { saveFile, type DownloadedFile, type RouteSetWith } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

import { useBazis } from './context.js';
import { keys } from './keys.js';
import { loose } from './types.js';

/** A route set with the download route of its items (bazis-uploadable, bazis-bg). */
export type DownloadPath = RouteSetWith<paths, '{item_id}/download/', 'get'>;

/**
 * Downloads the file of an item from the download route of its route set
 * (`<path><id>/download/`, with the token: never the URL of the media host, which serves a
 * file to anyone who has its link) and saves it under the name the backend gives it:
 * `mutate(id)`; its `error` is the `ApiError` (404: a file the user does not see).
 */
export function useDownload(path: DownloadPath): UseMutationResult<DownloadedFile, Error, string> {
  const { api } = useBazis();
  return useMutation({
    mutationFn: (id) => loose(api).download(path, id),
    onSuccess: (file) => {
      saveFile(file);
    },
  });
}

/**
 * The content of the file of an item as an object URL (the thumbnail of an image), read from
 * its download route while `id` is not null; null until it is read (or when it fails). The
 * URL is revoked when the content or the component changes. Keyed under the item, so a change
 * of the resource reads it again.
 */
export function useDownloadUrl(path: DownloadPath, id: string | null): string | null {
  const { api, scope } = useBazis();
  const content = useQuery({
    queryKey: keys.itemAction(path, id ?? '', 'download', scope),
    queryFn: async ({ signal }) => (await loose(api).download(path, id ?? '', { signal })).blob,
    enabled: id !== null,
  });
  const blob = id === null ? undefined : content.data;
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(
    () => () => {
      if (url !== null) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}
