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

import { House } from 'lucide-react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';

import { ErrorBoundary } from '@/app/errors';
import { PRODUCT_NAME } from '@/app/product';
import { LOGIN_ENABLED, signOut, useToken } from '@/app/session';
import { useLanguage } from '@/bazis/i18n';
import { useApi } from '@/bazis/react';
import { AppShell, type NavItem } from '@/bazis/ui/app-shell';
import { HomeScreen } from '@/screens/home';
import { LoginScreen } from '@/screens/login';

/**
 * The links of the navigation: a screen of the specs each (`nav:<screen>`), with its icon;
 * the label is the key of its text in the dictionaries of the product (`src/i18n/`). The link
 * of a screen of a resource names what the backend must allow the user (`requires`: `{path:
 * ROUTES['<app>.<model>']}` to view its items, `can: 'add'` to add one, `filters` of a
 * report), and the layout shows it once the backend does: never decide it by the role here.
 */
const NAVIGATION: readonly (NavItem & { label: string })[] = [{ screen: 'home', label: 'nav.home', to: '/', end: true, icon: House }];

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
    <AppShell title={PRODUCT_NAME} items={NAVIGATION.map((item) => ({ ...item, label: t(item.label) }))} session={LOGIN_ENABLED ? { onLogout } : null}>
      <ErrorBoundary resetKey={location.pathname}>
        <Outlet />
      </ErrorBoundary>
    </AppShell>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {LOGIN_ENABLED && <Route path="/login" element={<LoginScreen />} />}
        <Route element={<RequireSession />}>
          <Route index element={<HomeScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
