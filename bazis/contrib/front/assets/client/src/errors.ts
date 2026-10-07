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

/** An error object of a Bazis error response (`SchemaError` of the core). */
export interface ErrorObject {
  status?: number | string;
  title?: string | null;
  code?: string | null;
  detail?: string | null;
  source?: {
    pointer?: string | null;
    parameter?: string | null;
    id?: string | null;
    type?: string | null;
  } | null;
  meta?: Record<string, unknown> | null;
  traceback?: string | null;
}

const FIELD_POINTER = /^\/(?:attributes|relationships)\/([^/]+)/;

/** A response with an error status: 400 (e.g. `ERR_FILTER`), 401, 403, 404, 422... */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly errors: readonly ErrorObject[],
  ) {
    super(
      errors
        .map((error) => error.detail ?? error.title ?? error.code)
        .filter(Boolean)
        .join('; ') || `HTTP ${String(status)}`,
    );
  }

  /**
   * The messages of the errors of attributes and relationships, by their name
   * (`source.pointer` `/attributes/<name>` or `/relationships/<name>`), for forms.
   * Errors of nested values belong to the attribute that contains them.
   */
  fieldErrors(): Record<string, string[]> {
    const fields: Record<string, string[]> = {};
    for (const error of this.errors) {
      const name = FIELD_POINTER.exec(error.source?.pointer ?? '')?.[1];
      if (name !== undefined) {
        (fields[name] ??= []).push(error.detail ?? error.title ?? error.code ?? '');
      }
    }
    return fields;
  }
}

/** The error of a response with an error status; the body may be empty or not JSON. */
export function errorFromResponse(status: number, statusText: string, body: string): ApiError {
  let errors: unknown;
  try {
    errors = (JSON.parse(body) as { errors?: unknown } | null)?.errors;
  } catch {
    // not JSON: a page of a proxy or of a server error
  }
  if (Array.isArray(errors)) {
    return new ApiError(status, errors as ErrorObject[]);
  }
  return new ApiError(status, [{ status, title: statusText || null }]);
}
