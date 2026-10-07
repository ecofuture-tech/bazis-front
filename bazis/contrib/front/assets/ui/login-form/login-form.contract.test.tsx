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

// The contract of the login form: `field:username`, `field:password`, `action:submit`, the
// error of the backend as `state:error`. Keep it passing when the component is changed.

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/bazis/client';
import { LoginForm } from '@/bazis/ui/login-form';
import { Backend, renderWithBazis } from '@/bazis/ui/testing';

function fill() {
  fireEvent.change(screen.getByTestId('field:username'), { target: { value: 'manager' } });
  fireEvent.change(screen.getByTestId('field:password'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByTestId('action:submit'));
}

describe('LoginForm', () => {
  it('logs in with the credentials', async () => {
    const onLogin = vi.fn(() => Promise.resolve());
    const onSuccess = vi.fn();
    renderWithBazis(<LoginForm onLogin={onLogin} onSuccess={onSuccess} />, new Backend());
    fill();
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
    expect(onLogin).toHaveBeenCalledWith({ username: 'manager', password: 'secret' });
  });

  it('shows the error of the login', async () => {
    const onLogin = vi.fn(() => Promise.reject(new ApiError(401, [{ detail: 'Incorrect username or password' }])));
    renderWithBazis(<LoginForm onLogin={onLogin} />, new Backend());
    fill();
    expect((await screen.findByTestId('state:error')).textContent).toContain('Incorrect username or password');
  });
});
