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

import { FilePen, House, ListChecks } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';

import { ErrorBoundary } from '@/app/errors';
import { MAP_TILES, PRODUCT_NAME } from '@/app/product';
import { LOGIN_ENABLED, signOut, useToken } from '@/app/session';
import { CAPABILITIES, ROUTES } from '@/bazis/generated/contract';
import { useLanguage } from '@/bazis/i18n';
import { useApi } from '@/bazis/react';
import { SocketProvider, type Notification } from '@/bazis/react/ws';
import { AppShell, ListCardLayout, type NavItem } from '@/bazis/ui/app-shell';
import { FileFieldProvider } from '@/bazis/ui/file-field';
import { LiveQuery } from '@/bazis/ui/live-query';
import { MapProvider } from '@/bazis/ui/map';
import { NotificationCenter } from '@/bazis/ui/notification-center';
import { StatePanel } from '@/bazis/ui/state-panel';

/** The screens, each loaded with its own chunk when its route is first shown. */
const DraftTasksScreen = lazy(() => import('@/screens/draft-tasks').then((module) => ({ default: module.DraftTasksScreen })));
const HomeScreen = lazy(() => import('@/screens/home').then((module) => ({ default: module.HomeScreen })));
const LoginScreen = lazy(() => import('@/screens/login').then((module) => ({ default: module.LoginScreen })));
const TaskCardScreen = lazy(() => import('@/screens/task-card').then((module) => ({ default: module.TaskCardScreen })));
const TaskListScreen = lazy(() => import('@/screens/task-list').then((module) => ({ default: module.TaskListScreen })));

/** What a route shows while the chunk of its screen loads: the loading state of the screens. */
const loading = <StatePanel state="loading" />;

/**
 * The links of the navigation: a screen of the specs each (`nav:<screen>`), with its icon;
 * the label is the key of its text in the dictionaries of the product (`src/i18n/`). The
 * tasks and their report are shown to the users that the backend lets view them (`requires`).
 */
const NAVIGATION: readonly (NavItem & { label: string })[] = [
  { screen: 'home', label: 'nav.home', to: '/', end: true, icon: House },
  { screen: 'task-list', label: 'nav.tasks', to: '/tasks', icon: ListChecks, requires: { path: ROUTES['tasks.task'] } },
  { screen: 'draft-tasks', label: 'nav.drafts', to: '/drafts', icon: FilePen, requires: { path: ROUTES['tasks.task'] } },
];

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
  const navigate = useNavigate();
  if (LOGIN_ENABLED && !token) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  // the sign-out: the session ends, and bazis-authing deletes its stores
  const onLogout = () => {
    signOut(api);
  };
  // a notification of a task opens its card
  const open = (notification: Notification) => {
    if (notification.resource === 'tasks.task' && notification.id !== null) void navigate(`/tasks/${notification.id}`);
  };
  return (
    <AppShell
      title={PRODUCT_NAME}
      items={NAVIGATION.map((item) => ({ ...item, label: t(item.label) }))}
      session={LOGIN_ENABLED ? { onLogout } : null}
      // bazis-ws: the lists and the cards refetched when a task changes, the notifications
      tools={
        <>
          <LiveQuery />
          <NotificationCenter onOpen={open} />
        </>
      }
    >
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={loading}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

export function AppRouter() {
  // the socket of bazis-ws with the token of the session: none before the login, closed by
  // the logout
  const token = useToken();
  return (
    <SocketProvider path={CAPABILITIES.ws?.path ?? null} token={token}>
      {/* the file fields of the forms upload their files (bazis-uploadable), the point fields
          are placed on a map, and the maps draw the tiles of the product */}
      <FileFieldProvider>
        <MapProvider tiles={MAP_TILES}>
          <BrowserRouter>
            <Routes>
              {LOGIN_ENABLED && (
                <Route
                  path="/login"
                  element={
                    <Suspense fallback={loading}>
                      <LoginScreen />
                    </Suspense>
                  }
                />
              )}
              <Route element={<RequireSession />}>
                <Route index element={<HomeScreen />} />
                {/* the card next to the list or in its place (`composition.list_card` of the theme) */}
                <Route path="tasks" element={<ListCardLayout list={<TaskListScreen />} />}>
                  <Route path=":id" element={<TaskCardScreen />} />
                </Route>
                <Route path="drafts" element={<DraftTasksScreen />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </MapProvider>
      </FileFieldProvider>
    </SocketProvider>
  );
}
