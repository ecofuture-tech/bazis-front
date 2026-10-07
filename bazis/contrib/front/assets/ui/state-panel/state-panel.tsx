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
// state is marked `data-bz="state:<state>"`, as the scenarios of the specs expect it: the
// loading one too, drawn as the skeleton of what loads.

import {
  CircleAlert,
  FileQuestionMark,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { ApiError } from '@/bazis/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

/** The default title of each state; `message` of `StatePanel` replaces it. */
export const STATE_MESSAGES: Readonly<Record<ViewState, string>> = {
  loading: 'Loading…',
  empty: 'Nothing here yet.',
  loaded: '',
  error: 'Something went wrong.',
  forbidden: 'You are not allowed to see this.',
  not_found: 'Not found.',
  invalid: 'Some values are not valid.',
};

/** What the user can do about each state, under its title; `description` replaces it. */
export const STATE_HINTS: Readonly<Record<ViewState, string>> = {
  loading: '',
  empty: 'Items show up here once they are created.',
  loaded: '',
  error: 'The request failed. Try again in a moment.',
  forbidden: 'Your role does not give access to this. Ask an administrator if you need it.',
  not_found: 'It may have been deleted, or the link is wrong.',
  invalid: 'Correct the highlighted values and try again.',
};

const ICONS: Readonly<Record<Exclude<ViewState, 'loading' | 'loaded'>, LucideIcon>> = {
  empty: Inbox,
  error: TriangleAlert,
  forbidden: LockKeyhole,
  not_found: FileQuestionMark,
  invalid: CircleAlert,
};

/** The colors of the icon of each state: the tones of the theme. */
const TONES: Readonly<Record<Exclude<ViewState, 'loading' | 'loaded'>, string>> = {
  empty: 'bg-muted text-muted-foreground',
  error: 'bg-danger-soft text-danger-ink',
  forbidden: 'bg-warning-soft text-warning-ink',
  not_found: 'bg-muted text-muted-foreground',
  invalid: 'bg-danger-soft text-danger-ink',
};

/** The skeleton of a block of text, while what it shows loads. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('grid gap-3', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export interface StatePanelProps {
  state: ViewState;
  /** The error of the state: its message is shown for `error` and `invalid`. */
  error?: unknown;
  /** Replaces the default title of the state. */
  message?: ReactNode;
  /** Replaces the default hint of the state (the message of an error by default). */
  description?: ReactNode;
  /** Shows a retry button (`action:retry`) in the `error` state. */
  onRetry?: () => void;
  /** One line, without the frame: inside a form or a bar. */
  inline?: boolean;
  /** The `loading` state: the skeleton of the content (lines of text by default). */
  skeleton?: ReactNode;
  /** The content of the `loaded` state. */
  children?: ReactNode;
  className?: string;
}

/**
 * Renders a state: the content in `loaded`, its skeleton in `loading`, an icon with a title
 * and a hint in the others, each marked `data-bz="state:<state>"`.
 */
export function StatePanel({
  state,
  error,
  message,
  description,
  onRetry,
  inline = false,
  skeleton,
  children,
  className,
}: StatePanelProps) {
  if (state === 'loaded') {
    return (
      <div data-bz="state:loaded" className={className}>
        {children}
      </div>
    );
  }
  if (state === 'loading') {
    return (
      <div data-bz="state:loading" role="status" aria-busy="true" className={className}>
        {skeleton === undefined && inline ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {message ?? STATE_MESSAGES.loading}
          </span>
        ) : (
          <>
            <span className="sr-only">{message ?? STATE_MESSAGES.loading}</span>
            {skeleton ?? <SkeletonLines />}
          </>
        )}
      </div>
    );
  }
  const failed = state !== 'empty';
  const detail =
    (state === 'error' || state === 'invalid') && error instanceof Error && error.message ? error.message : null;
  const Icon = ICONS[state];
  if (inline) {
    return (
      <div
        data-bz={`state:${state}`}
        role={failed ? 'alert' : 'status'}
        className={cn(
          'flex items-start gap-2 rounded-md px-3 py-2 text-sm',
          failed ? 'bg-danger-soft text-danger-ink' : 'bg-muted text-muted-foreground',
          className,
        )}
      >
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>{message ?? detail ?? STATE_MESSAGES[state]}</p>
      </div>
    );
  }
  return (
    <div
      data-bz={`state:${state}`}
      role={failed ? 'alert' : 'status'}
      className={cn(
        'flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center',
        className,
      )}
    >
      <span className={cn('flex size-12 items-center justify-center rounded-full', TONES[state])}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="grid max-w-md gap-1">
        <p className="font-medium text-foreground">{message ?? STATE_MESSAGES[state]}</p>
        <p className="text-sm text-muted-foreground">{description ?? detail ?? STATE_HINTS[state]}</p>
      </div>
      {state === 'error' && onRetry && (
        <Button type="button" variant="outline" size="sm" data-bz="action:retry" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
