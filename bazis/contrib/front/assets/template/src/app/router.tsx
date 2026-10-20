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

import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';

import { ErrorBoundary } from '@/app/errors';
import { lazyScreen } from '@/app/lazy';
import { LOGIN_ENABLED, signOut, useToken } from '@/app/session';
import { useLanguage } from '@/bazis/i18n';
import { useApi } from '@/bazis/react';
import { AppShell, type NavEntry } from '@/bazis/ui/app-shell';
import { navigation } from '@/screens/generated/navigation';
import { PRODUCT_NAME } from '@/screens/generated/product';
import { GeneratedProviders } from '@/screens/generated/providers';
import { PUBLIC_ROUTES, SCREEN_ROUTES } from '@/screens/generated/routes';
import { TOOLS } from '@/screens/generated/tools';

// The screens, their routes, the navigation, the providers and the tools of the layout are
// generated from the specs (`bazis_front screens`, `src/screens/generated/`): a screen, a link
// or a route is added in `spec/`, never here.

const LoginScreen = lazyScreen(() => import('@/screens/login').then((module) => module.LoginScreen));

/** The links of a user without a session: those of the public screens, a group with its public links. */
function publicLinks(entries: readonly NavEntry[]): NavEntry[] {
  return entries.flatMap((entry): NavEntry[] => {
    if (!('items' in entry)) return entry.public ? [entry] : [];
    const items = entry.items.filter((it) => it.public);
    return items.length ? [{ ...entry, items }] : [];
  });
}

/**
 * The layout of the application (a sidebar or a top bar, `navigation` of spec/design/theme.yaml)
 * around the screens. With a session: every link, the logout and the tools (the notifications,
 * the live queries). Without one: the links of the public screens and the sign-in, which comes
 * back here after the login. Without a login (no bazis-users) every screen is open.
 */
function Layout() {
  const token = useToken();
  const api = useApi();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const signedIn = !LOGIN_ENABLED || token !== null;
  const items = navigation(t);
  // the sign-out: the session ends, and bazis-authing deletes its stores
  const onLogout = () => {
    signOut(api);
  };
  const signIn = () => {
    void navigate('/login', { state: { from: location.pathname + location.search } });
  };
  return (
    <AppShell
      title={t(PRODUCT_NAME)}
      items={signedIn ? items : publicLinks(items)}
      session={LOGIN_ENABLED && signedIn ? { onLogout } : null}
      signIn={signedIn ? undefined : signIn}
      tools={signedIn ? TOOLS : null}
    >
      <ErrorBoundary resetKey={location.pathname}>
        <Outlet />
      </ErrorBoundary>
    </AppShell>
  );
}

/** The screens of a session: a user without one goes to the login screen and comes back. */
function RequireSession() {
  const token = useToken();
  const location = useLocation();
  if (LOGIN_ENABLED && !token) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Layout />;
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
          {/* the public screens (an anonymous role of the specs), with or without a session */}
          <Route element={<Layout />}>{PUBLIC_ROUTES}</Route>
          <Route element={<RequireSession />}>{SCREEN_ROUTES}</Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GeneratedProviders>
  );
}
