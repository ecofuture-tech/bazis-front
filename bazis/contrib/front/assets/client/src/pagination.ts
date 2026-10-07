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

import type { Page } from './types.js';

/** `links` of a list response (`PaginationLinks` of the core); absent links are null. */
export interface PaginationLinks {
  first?: string | null;
  last?: string | null;
  prev?: string | null;
  next?: string | null;
}

/** `meta.pagination` of a list response requested with `meta: ['pagination']`. */
export interface PaginationMeta {
  count: number;
  limit: number;
  offset: number;
}

interface ListDocument {
  links?: PaginationLinks | null;
  meta?: { pagination?: PaginationMeta | null } | null;
}

/** The page after this one, to pass as `page` of the next `list`; null on the last page. */
export function nextPage(document: ListDocument): Page | null {
  return pageOfLink(document.links?.next);
}

/** The page before this one; null on the first page. */
export function prevPage(document: ListDocument): Page | null {
  return pageOfLink(document.links?.prev);
}

/** The total count, limit and offset; null unless the list was requested with this meta. */
export function pagination(document: ListDocument): PaginationMeta | null {
  return document.meta?.pagination ?? null;
}

// The links are absolute URLs built by the server from the request URL, which may differ
// from the URL the client sees behind a proxy: only their page parameters are used.
function pageOfLink(link: string | null | undefined): Page | null {
  if (!link) return null;
  const params = new URL(link, 'http://localhost').searchParams;
  const limit = params.get('page[limit]');
  return {
    offset: Number(params.get('page[offset]') ?? 0),
    ...(limit === null ? {} : { limit: Number(limit) }),
  };
}
