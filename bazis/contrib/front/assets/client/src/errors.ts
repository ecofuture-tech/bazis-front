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

/**
 * The pointer of an attribute or a relationship of the item of the request: `/attributes/<name>`
 * (the body that the schema refuses) or `/data/attributes/<name>`, `/data/relationships/<name>`
 * (the checks of the backend: the model, a related item, `validate_item`).
 */
const FIELD_POINTER = /^(?:\/data)?\/(?:attributes|relationships)\/([^/]+)/;
/** The pointer of an included item, `/included/<index>`, and of one of its fields. */
const INCLUDED_POINTER = /^\/included\/(\d+)(?:\/(?:attributes|relationships)\/([^/]+))?/;

/**
 * An error of a request that is not of a field of its item: of the item as a whole
 * (`/data`, an invariant of `validate_item`: `ERR_ITEM_INVALID`), of an included item
 * (`/included/<index>`, of its field `field`), of a parameter or of the request.
 */
export interface FormError {
  message: string;
  /** The index of the included item in `included` of the document, null for the item itself. */
  included: number | null;
  /** The attribute or relationship of the included item, null for the whole item. */
  field: string | null;
}

function messageOf(error: ErrorObject): string {
  return error.detail ?? error.title ?? error.code ?? '';
}

function fieldOf(error: ErrorObject): string | undefined {
  return FIELD_POINTER.exec(error.source?.pointer ?? '')?.[1];
}

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
   * The messages of the errors of attributes and relationships of the item, by their name
   * (`source.pointer` `/data/attributes/<name>`, `/data/relationships/<name>`,
   * `/attributes/<name>` or `/relationships/<name>`), for forms. Errors of nested values
   * belong to the attribute that contains them.
   */
  fieldErrors(): Record<string, string[]> {
    const fields: Record<string, string[]> = {};
    for (const error of this.errors) {
      const name = fieldOf(error);
      if (name !== undefined) {
        (fields[name] ??= []).push(messageOf(error));
      }
    }
    return fields;
  }

  /**
   * The errors that `fieldErrors()` does not give, for the form as a whole: of the item
   * (`/data`), of an included item (`/included/<index>`), of a parameter or of the request.
   */
  formErrors(): FormError[] {
    return this.errors
      .filter((error) => fieldOf(error) === undefined)
      .map((error) => {
        const included = INCLUDED_POINTER.exec(error.source?.pointer ?? '');
        return {
          message: messageOf(error),
          included: included ? Number(included[1]) : null,
          field: included?.[2] ?? null,
        };
      });
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
