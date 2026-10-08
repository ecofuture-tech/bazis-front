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

// The login form: the username and the password (`field:username`, `field:password`,
// `action:submit`) and the buttons of the other logins (`action:login-<id>`, such as the
// Google login of bazis-authing, with a cancel while it waits), the error of a login as
// `state:error`. The login itself is the product's: the template passes `login()` and the
// logins of `src/app/session.ts` (the token endpoint of bazis-users, or the services of
// bazis-authing).

import { useMutation } from '@tanstack/react-query';
import { LoaderCircle, LogIn } from 'lucide-react';
import { useId, useRef, useState, type ReactNode, type SubmitEvent } from 'react';

import { StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface Credentials {
  username: string;
  password: string;
}

/** A login other than the password, a button `action:login-<id>`. */
export interface LoginMethod {
  /** The id of the login (the code of a service of bazis-authing: `google`). */
  id: string;
  label: ReactNode;
  /** Logs in (in a window of the service); the signal aborts it (the cancel). Rejects with its error. */
  onLogin: (signal: AbortSignal) => Promise<void>;
}

export interface LoginFormProps {
  /** Logs in with the username and the password; rejects with the error of the backend. Without it the form has no fields. */
  onLogin?: ((credentials: Credentials) => Promise<void>) | undefined;
  /** The other logins: a button each. */
  methods?: readonly LoginMethod[];
  /** Called after a login. */
  onSuccess?: () => void;
  title?: ReactNode;
  /** Under the title. */
  description?: ReactNode;
}

/** An abort: a DOMException `AbortError` (not an Error in every environment). */
function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/** The login of a user with a username and a password, and with the other logins of the backend. */
export function LoginForm({
  onLogin,
  methods = [],
  onSuccess,
  title = 'Log in',
  description = onLogin ? 'Enter your username and password to continue.' : 'Choose how to log in.',
}: LoginFormProps) {
  const id = useId();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const running = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationFn: async (login: { credentials: Credentials } | { method: LoginMethod; signal: AbortSignal }) => {
      if ('method' in login) await login.method.onLogin(login.signal);
      else await onLogin?.(login.credentials);
    },
    onSuccess: () => {
      onSuccess?.();
    },
  });
  const waiting = mutation.isPending && 'method' in mutation.variables ? mutation.variables : null;
  const failed = mutation.isError && !isAbort(mutation.error);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ credentials: { username, password } });
  }

  function start(method: LoginMethod) {
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    mutation.mutate({ method, signal: controller.signal });
  }

  const buttons = methods.length > 0 && (
    <div className="grid gap-2">
      {methods.map((method) => {
        const current = waiting && 'method' in waiting && waiting.method.id === method.id;
        return (
          <Button
            key={method.id}
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            data-bz={`action:login-${method.id}`}
            disabled={mutation.isPending}
            onClick={() => {
              start(method);
            }}
          >
            {current ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
            {method.label}
          </Button>
        );
      })}
      {waiting && (
        <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground" role="status">
          Finish the login in its window. If you closed it, cancel.
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              running.current?.abort();
              running.current = null;
            }}
          >
            Cancel
          </Button>
        </p>
      )}
    </div>
  );

  return (
    <Card className="w-full max-w-sm gap-6 shadow-lg">
      <CardHeader className="gap-1.5">
        <CardTitle>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {onLogin && (
          <form onSubmit={submit} className="grid gap-4" aria-busy={(mutation.isPending && !waiting) || undefined}>
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
            {failed && <StatePanel inline state="error" error={mutation.error} />}
            <Button type="submit" size="lg" className="mt-1 w-full" data-bz="action:submit" disabled={mutation.isPending}>
              {mutation.isPending && !waiting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Log in
            </Button>
          </form>
        )}
        {onLogin && buttons && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        )}
        {buttons}
        {!onLogin && failed && <StatePanel inline state="error" error={mutation.error} />}
      </CardContent>
    </Card>
  );
}
