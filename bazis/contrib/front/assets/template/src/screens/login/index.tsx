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

import { useLocation, useNavigate } from 'react-router';

import { PRODUCT_NAME } from '@/app/product';
import { login } from '@/app/session';
import { useApi } from '@/bazis/react';
import { LoginForm } from '@/bazis/ui/login-form';

/** The login of bazis-users; back to the screen the user came from. */
export function LoginScreen() {
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  return (
    <main
      data-bz="screen:login"
      className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-[radial-gradient(ellipse_at_top,var(--color-primary-soft),transparent_65%)] p-4"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-sm"
        >
          {PRODUCT_NAME.charAt(0).toUpperCase()}
        </span>
        <span className="font-display text-xl font-semibold tracking-tight">{PRODUCT_NAME}</span>
      </div>
      <LoginForm
        onLogin={(credentials) => login(api, credentials)}
        onSuccess={() => {
          void navigate(from, { replace: true });
        }}
      />
    </main>
  );
}
