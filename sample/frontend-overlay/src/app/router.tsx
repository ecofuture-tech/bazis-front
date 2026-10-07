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

import { House, ListChecks } from 'lucide-react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';

import { ErrorBoundary } from '@/app/errors';
import { PRODUCT_NAME } from '@/app/product';
import { LOGIN_ENABLED, logout, useToken } from '@/app/session';
import { AppShell, ListCardLayout, type NavItem } from '@/bazis/ui/app-shell';
import { HomeScreen } from '@/screens/home';
import { LoginScreen } from '@/screens/login';
import { TaskCardScreen } from '@/screens/task-card';
import { TaskListScreen } from '@/screens/task-list';

/** The links of the navigation: a screen of the specs each (`nav:<screen>`), with its icon. */
const NAVIGATION: readonly NavItem[] = [
  { screen: 'home', label: 'Home', to: '/', end: true, icon: House },
  { screen: 'task-list', label: 'Tasks', to: '/tasks', icon: ListChecks },
];

/**
 * The screens of a logged-in user in the layout of the application (a sidebar or a top bar,
 * `navigation` of spec/design/theme.yaml); the others go to the login screen and come back.
 * Without a login (no bazis-users) they are open.
 */
function RequireSession() {
  const token = useToken();
  const location = useLocation();
  if (LOGIN_ENABLED && !token) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return (
    <AppShell title={PRODUCT_NAME} items={NAVIGATION} session={LOGIN_ENABLED ? { onLogout: logout } : null}>
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
          {/* the card next to the list or in its place (`composition.list_card` of the theme) */}
          <Route path="tasks" element={<ListCardLayout list={<TaskListScreen />} />}>
            <Route path=":id" element={<TaskCardScreen />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
