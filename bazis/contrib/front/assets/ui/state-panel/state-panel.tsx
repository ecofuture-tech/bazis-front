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

// The states of a screen, the only place where an error of the backend becomes a state:
// 401 and 403 are `forbidden`, 404 `not_found`, 422 `invalid`, any other `error`. Every
// state is marked `data-bz="state:<state>"`, as the scenarios of the specs expect it.

import type { ReactNode } from 'react';

import { ApiError } from '@/bazis/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The states of the specs (`states` of a screen). */
export type ViewState = 'loading' | 'empty' | 'loaded' | 'error' | 'forbidden' | 'not_found' | 'invalid';

export type ErrorState = Extract<ViewState, 'error' | 'forbidden' | 'not_found' | 'invalid'>;

/** The state of an error: 401 and 403 `forbidden`, 404 `not_found`, 422 `invalid`, else `error`. */
export function errorState(error: unknown): ErrorState {
  if (!(error instanceof ApiError)) return 'error';
  if (error.status === 401 || error.status === 403) return 'forbidden';
  if (error.status === 404) return 'not_found';
  if (error.status === 422) return 'invalid';
  return 'error';
}

/**
 * The state of a query of the hooks: `loading` until it has data, the state of its error,
 * `empty` when the caller says so, else `loaded`.
 */
export function queryState(
  query: { status: 'pending' | 'error' | 'success'; error: unknown },
  empty = false,
): ViewState {
  if (query.status === 'pending') return 'loading';
  if (query.status === 'error') return errorState(query.error);
  return empty ? 'empty' : 'loaded';
}

/** The default message of each state; `message` of `StatePanel` replaces it. */
export const STATE_MESSAGES: Readonly<Record<ViewState, string>> = {
  loading: 'Loading…',
  empty: 'Nothing here yet.',
  loaded: '',
  error: 'Something went wrong.',
  forbidden: 'You are not allowed to see this.',
  not_found: 'Not found.',
  invalid: 'Some values are not valid.',
};

export interface StatePanelProps {
  state: ViewState;
  /** The error of the state: its message is shown for `error` and `invalid`. */
  error?: unknown;
  /** Replaces the default message of the state. */
  message?: ReactNode;
  /** Shows a retry button (`action:retry`) in the `error` state. */
  onRetry?: () => void;
  /** One line, without the frame: inside a form or a bar. */
  inline?: boolean;
  /** The content of the `loaded` state. */
  children?: ReactNode;
  className?: string;
}

/**
 * Renders a state: the content in `loaded`, a message in the others, each marked
 * `data-bz="state:<state>"`.
 */
export function StatePanel({ state, error, message, onRetry, inline = false, children, className }: StatePanelProps) {
  if (state === 'loaded') {
    return (
      <div data-bz="state:loaded" className={className}>
        {children}
      </div>
    );
  }
  const failed = state !== 'loading' && state !== 'empty';
  const detail =
    (state === 'error' || state === 'invalid') && error instanceof Error && error.message ? error.message : null;
  return (
    <div
      data-bz={`state:${state}`}
      role={failed ? 'alert' : 'status'}
      aria-busy={state === 'loading' || undefined}
      className={cn(
        inline ? 'text-sm' : 'flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center',
        failed ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      <p>{message ?? detail ?? STATE_MESSAGES[state]}</p>
      {state === 'error' && onRetry && (
        <Button type="button" variant="outline" size="sm" data-bz="action:retry" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
