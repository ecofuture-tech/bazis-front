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

import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { errorMessage } from '@/app/errors';
import { useApi } from '@/app/providers';
import { login } from '@/app/session';

export function LoginScreen() {
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({
    mutationFn: () => login(api, { username, password }),
    onSuccess: () => navigate(from, { replace: true }),
  });

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Log in</h1>
        <label className="block space-y-1 text-sm">
          <span>Username</span>
          <input
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
            }}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(mutation.error)}
          </p>
        )}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
        >
          Log in
        </button>
      </form>
    </main>
  );
}
