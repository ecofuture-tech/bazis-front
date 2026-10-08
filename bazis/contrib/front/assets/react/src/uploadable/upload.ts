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

// The uploads of bazis-uploadable: a file is the multipart create of a route set of
// `FileUploadRouteSet` (`upload` of the client, with XMLHttpRequest for its progress); a
// model references it by a to-one relationship, which a form sets to the id of the created
// item.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import type { UploadProgress } from '@/bazis/client';

import { useBazis } from '../context.js';
import { invalidateResource } from '../mutations.js';
import type { CreatePath, CreateResponse } from '../types.js';

/** The route sets that create an item: those of the uploaded files among them. */
export type UploadPath = CreatePath;
export type UploadResponse<P extends UploadPath> = CreateResponse<P>;

/** The upload of a file to a route set of bazis-uploadable. */
export interface Upload<Item> {
  /**
   * Uploads a file (after the one running is aborted): resolves to the created item, or to
   * null when it is aborted; rejects with the error of the backend (an `ApiError`: 413
   * `ERR_FILE_TOO_LARGE`, 401, 403...) or of the network, also in `error`.
   */
  upload: (file: File, options?: { name?: string }) => Promise<Item | null>;
  /** Aborts the upload that is running: back to `idle`. */
  abort: () => void;
  /** Forgets the last upload (its item or its error). */
  reset: () => void;
  status: 'idle' | 'uploading' | 'success' | 'error';
  /** The bytes sent while the file uploads; null otherwise. */
  progress: UploadProgress | null;
  error: Error | null;
  /** The created item of the last upload. */
  data: Item | undefined;
}

/** An abort: a DOMException `AbortError` (not an Error in every environment). */
function aborted(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/**
 * The upload of files to a route set of bazis-uploadable (`ROUTES['uploadable.file_upload']`):
 * one at a time, with its progress; it refetches the queries of the route set.
 */
export function useUpload<P extends UploadPath>(path: P): Upload<UploadResponse<P>> {
  const { api } = useBazis();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationFn: ({ file, name, signal }: { file: File; name?: string | undefined; signal: AbortSignal }) =>
      api.upload(path, file, {
        signal,
        onProgress: setProgress,
        ...(name === undefined ? {} : { name }),
      }),
    onSuccess: () => invalidateResource(queryClient, path),
    onSettled: () => {
      setProgress(null);
    },
  });
  const { mutateAsync, reset } = mutation;

  // read at the end of an upload: `abort` or another upload changed it meanwhile
  const running = useCallback(() => controller.current, []);

  const abort = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);

  const upload = useCallback(
    async (file: File, options: { name?: string } = {}) => {
      abort();
      const current = new AbortController();
      controller.current = current;
      setProgress({ loaded: 0, total: file.size });
      try {
        return await mutateAsync({ file, name: options.name, signal: current.signal });
      } catch (error) {
        if (!aborted(error)) throw error;
        // an abort is no error: the state of the upload is forgotten
        if (running() === null) reset();
        return null;
      } finally {
        if (running() === current) controller.current = null;
      }
    },
    [abort, mutateAsync, reset, running],
  );

  return {
    upload,
    abort,
    reset,
    status: mutation.status === 'pending' ? 'uploading' : mutation.status,
    progress: mutation.status === 'pending' ? progress : null,
    error: mutation.error,
    data: mutation.data,
  };
}
