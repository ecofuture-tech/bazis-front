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

import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';

import { ErrorBoundary } from '@/app/errors';
import { lazyScreen } from '@/app/lazy';
import { LOGIN_ENABLED, signOut, useToken } from '@/app/session';
import { useLanguage } from '@/bazis/i18n';
import { useApi } from '@/bazis/react';
import { AppShell } from '@/bazis/ui/app-shell';
import { navigation } from '@/screens/generated/navigation';
import { PRODUCT_NAME } from '@/screens/generated/product';
import { GeneratedProviders } from '@/screens/generated/providers';
import { SCREEN_ROUTES } from '@/screens/generated/routes';
import { TOOLS } from '@/screens/generated/tools';

// The screens, their routes, the navigation, the providers and the tools of the layout are
// generated from the specs (`bazis_front screens`, `src/screens/generated/`): a screen, a link
// or a route is added in `spec/`, never here.

const LoginScreen = lazyScreen(() => import('@/screens/login').then((module) => module.LoginScreen));

/**
 * The screens of a logged-in user in the layout of the application (a sidebar or a top bar,
 * `navigation` of spec/design/theme.yaml); the others go to the login screen and come back.
 * Without a login (no bazis-users) they are open.
 */
function RequireSession() {
  const token = useToken();
  const api = useApi();
  const { t } = useLanguage();
  const location = useLocation();
  if (LOGIN_ENABLED && !token) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  // the sign-out: the session ends, and bazis-authing deletes its stores
  const onLogout = () => {
    signOut(api);
  };
  return (
    <AppShell title={t(PRODUCT_NAME)} items={navigation(t)} session={LOGIN_ENABLED ? { onLogout } : null} tools={TOOLS}>
      <ErrorBoundary resetKey={location.pathname}>
        <Outlet />
      </ErrorBoundary>
    </AppShell>
  );
}

export function AppRouter() {
  return (
    <GeneratedProviders>
      <BrowserRouter>
        <Routes>
          {LOGIN_ENABLED && (
            <Route
              path="/login"
              element={
                <ErrorBoundary>
                  <LoginScreen />
                </ErrorBoundary>
              }
            />
          )}
          <Route element={<RequireSession />}>{SCREEN_ROUTES}</Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GeneratedProviders>
  );
}
