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

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ErrorBoundary } from '@/app/errors';
import { ApiError } from '@/bazis/client';

afterEach(cleanup);

let failing = true;

function Screen({ error }: { error: unknown }): string {
  if (failing) throw error;
  return 'screen';
}

describe('ErrorBoundary', () => {
  it('shows the state of the error of a screen and retries', () => {
    failing = true;
    render(
      <ErrorBoundary>
        <Screen error={new Error('Broken screen')} />
      </ErrorBoundary>,
    );
    const state = screen.getByRole('alert');
    expect(state.getAttribute('data-bz')).toBe('state:error');
    expect(state.textContent).toContain('Broken screen');

    failing = false;
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByText('screen')).toBeTruthy();
  });

  it('maps an error of the backend to its state', () => {
    failing = true;
    render(
      <ErrorBoundary>
        <Screen error={new ApiError(403, [])} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').getAttribute('data-bz')).toBe('state:forbidden');
  });
});
