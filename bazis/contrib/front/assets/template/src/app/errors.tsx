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

import { Component, type ReactNode } from 'react';

import { ApiError } from '@/bazis/client';

/**
 * The message of an error for the user: the backend writes the messages of ApiError
 * (validation errors are shown by field with `ApiError.fieldErrors()`).
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return 'You are not allowed to do this.';
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
  error: unknown;
}

/** Shows the error of a screen instead of a blank page, with a retry. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, error: undefined };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-xl space-y-4 p-8">
        <p className="text-destructive">{errorMessage(this.state.error)}</p>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={() => {
            this.setState({ failed: false, error: undefined });
          }}
        >
          Retry
        </button>
      </div>
    );
  }
}
