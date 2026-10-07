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

// The contract of the state panel: every state is marked `state:<state>` (the loading one
// as a busy skeleton), the errors of the backend map to their states; and the toasts of the
// feedback. Keep it passing when the component is changed.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/bazis/client';
import { errorState, queryState, StatePanel, toast, Toaster, type ViewState } from '@/bazis/ui/state-panel';
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

  it('draws the loading state as a skeleton, marked and busy', () => {
    const { unmount } = render(<StatePanel state="loading" />);
    const loading = screen.getByTestId('state:loading');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    unmount();
    render(<StatePanel state="loading" skeleton={<span>rows</span>} />);
    expect(screen.getByTestId('state:loading').textContent).toContain('rows');
  });

  it('tells what to do about a state', () => {
    render(<StatePanel state="forbidden" />);
    const forbidden = screen.getByTestId('state:forbidden');
    expect(forbidden.getAttribute('role')).toBe('alert');
    expect(forbidden.querySelector('svg')).not.toBeNull();
    expect(forbidden.textContent).toContain('administrator');
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

describe('toast', () => {
  it('shows the feedback of a change in a live region', () => {
    render(<Toaster />);
    act(() => {
      toast({ title: 'Saved', description: 'The task is saved.' });
    });
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toContain('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(region.textContent).not.toContain('Saved');
  });
});
