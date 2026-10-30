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

// The files of the download routes (bazis-uploadable `<files>/{id}/download/`, bazis-bg
// `<tasks>/{id}/download/`): read with the token of the session, not from the URL of the
// media host, which serves a file to anyone who has its link.

/** A file read from a download route: its content, the name the backend gives it and its meta. */
export interface DownloadedFile {
  blob: Blob;
  /** The file name of `Content-Disposition`; null without one. */
  name: string | null;
  /**
   * What the backend answers next to the file (the number of rows of an export): the JSON
   * object of the header `X-Bazis-Meta` (`file_meta` of bazis 2.25); null without it.
   */
  meta: Readonly<Record<string, unknown>> | null;
}

/**
 * The meta of a file, the JSON object of the header `X-Bazis-Meta`: null without it, and null
 * with a warning when it is not a JSON object (the file is saved all the same).
 */
export function fileMeta(header: string | null): Readonly<Record<string, unknown>> | null {
  if (header === null) return null;
  try {
    const meta: unknown = JSON.parse(header);
    if (typeof meta === 'object' && meta !== null && !Array.isArray(meta)) return meta as Record<string, unknown>;
  } catch {
    // not JSON: warned below
  }
  console.warn(`The header X-Bazis-Meta of the file is not a JSON object: ${header}`);
  return null;
}

/**
 * The file name of a `Content-Disposition` header (Django `content_disposition_header`):
 * `filename*=utf-8''<percent-encoded>` (a name that is not ASCII), else `filename="<name>"`.
 */
export function dispositionName(header: string | null): string | null {
  if (!header) return null;
  const extended = /filename\*\s*=\s*([\w-]+)'[^']*'([^;]+)/i.exec(header);
  if (extended?.[2]) {
    try {
      return decodeURIComponent(extended[2].trim());
    } catch {
      // a malformed encoding: the plain name, if any
    }
  }
  const plain = /filename\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;]+))/i.exec(header);
  const name = plain?.[1]?.replace(/\\(.)/g, '$1') ?? plain?.[2]?.trim();
  return name || null;
}

/** How long the URL of a saved file lives, in milliseconds: the browser has read it by then. */
const REVOKE_AFTER = 40_000;

/** Saves a downloaded file in the browser under its name (`fallback` without one). */
export function saveFile({ blob, name }: Pick<DownloadedFile, 'blob' | 'name'>, fallback = 'download'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name ?? fallback;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_AFTER);
}
