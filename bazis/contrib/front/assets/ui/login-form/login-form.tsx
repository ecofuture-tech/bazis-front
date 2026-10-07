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

// The login form: the username and the password (`field:username`, `field:password`),
// `action:submit`, the error of the login as `state:error`. The login itself is the
// product's: the template passes `login()` of `src/app/session.ts` (the token endpoint of
// bazis-users).

import { useMutation } from '@tanstack/react-query';
import { useId, useState, type ReactNode, type SubmitEvent } from 'react';

import { StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface Credentials {
  username: string;
  password: string;
}

export interface LoginFormProps {
  /** Logs in; rejects with the error of the backend. */
  onLogin: (credentials: Credentials) => Promise<void>;
  /** Called after the login. */
  onSuccess?: () => void;
  title?: ReactNode;
}

/** The login of a user with a username and a password. */
export function LoginForm({ onLogin, onSuccess, title = 'Log in' }: LoginFormProps) {
  const id = useId();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({
    mutationFn: (credentials: Credentials) => onLogin(credentials),
    onSuccess: () => {
      onSuccess?.();
    },
  });

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ username, password });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{title}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4" aria-busy={mutation.isPending || undefined}>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-username`}>Username</Label>
            <Input
              id={`${id}-username`}
              name="username"
              autoComplete="username"
              required
              data-bz="field:username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-password`}>Password</Label>
            <Input
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              data-bz="field:password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
          </div>
          {mutation.isError && <StatePanel inline state="error" error={mutation.error} />}
          <Button type="submit" data-bz="action:submit" disabled={mutation.isPending}>
            Log in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
