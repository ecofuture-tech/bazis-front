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

// The contract of the state panel: every state is marked `state:<state>`, the errors of the
// backend map to their states. Keep it passing when the component is changed.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/bazis/client';
import { errorState, queryState, StatePanel, type ViewState } from '@/bazis/ui/state-panel';
import '@/bazis/ui/testing';

describe('StatePanel', () => {
  it('marks every state', () => {
    const states: ViewState[] = ['loading', 'empty', 'error', 'forbidden', 'not_found', 'invalid'];
    for (const state of states) {
      const { unmount } = render(<StatePanel state={state} />);
      expect(screen.getByTestId(`state:${state}`)).toBeTruthy();
      unmount();
    }
    render(<StatePanel state="loaded">content</StatePanel>);
    expect(screen.getByTestId('state:loaded').textContent).toBe('content');
  });

  it('shows the message of an error and retries', () => {
    const retry = vi.fn();
    render(<StatePanel state="error" error={new ApiError(500, [{ detail: 'Server down' }])} onRetry={retry} />);
    expect(screen.getByTestId('state:error').textContent).toContain('Server down');
    fireEvent.click(screen.getByTestId('action:retry'));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('errorState', () => {
  it('maps the statuses of the backend', () => {
    expect(errorState(new ApiError(401, []))).toBe('forbidden');
    expect(errorState(new ApiError(403, []))).toBe('forbidden');
    expect(errorState(new ApiError(404, []))).toBe('not_found');
    expect(errorState(new ApiError(422, []))).toBe('invalid');
    expect(errorState(new ApiError(500, []))).toBe('error');
    expect(errorState(new TypeError('Failed to fetch'))).toBe('error');
  });

  it('gives the state of a query', () => {
    expect(queryState({ status: 'pending', error: null })).toBe('loading');
    expect(queryState({ status: 'error', error: new ApiError(404, []) })).toBe('not_found');
    expect(queryState({ status: 'success', error: null }, true)).toBe('empty');
    expect(queryState({ status: 'success', error: null })).toBe('loaded');
  });
});
