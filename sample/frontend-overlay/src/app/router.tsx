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
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';

import { ErrorBoundary } from '@/app/errors';
import { lazyScreen } from '@/app/lazy';
import { MAP_TILES, PRODUCT_NAME } from '@/app/product';
import { LOGIN_ENABLED, signOut, useToken } from '@/app/session';
import { CAPABILITIES, ROUTES } from '@/bazis/generated/contract';
import { useLanguage } from '@/bazis/i18n';
import { useApi } from '@/bazis/react';
import { useInbox, type InboxNotification } from '@/bazis/react/notify';
import { SocketProvider } from '@/bazis/react/ws';
import { AppShell, ListCardLayout, type NavItem } from '@/bazis/ui/app-shell';
import { FileFieldProvider } from '@/bazis/ui/file-field';
import { LiveQuery } from '@/bazis/ui/live-query';
import { MapProvider } from '@/bazis/ui/map';
import { NotificationCenter } from '@/bazis/ui/notification-center';

/** The screens, each loaded with its own chunk when its route is first shown. */
const DraftTasksScreen = lazyScreen(() => import('@/screens/draft-tasks').then((module) => module.DraftTasksScreen));
const HomeScreen = lazyScreen(() => import('@/screens/home').then((module) => module.HomeScreen));
const LoginScreen = lazyScreen(() => import('@/screens/login').then((module) => module.LoginScreen));
const TaskCardScreen = lazyScreen(() => import('@/screens/task-card').then((module) => module.TaskCardScreen));
const TaskListScreen = lazyScreen(() => import('@/screens/task-list').then((module) => module.TaskListScreen));

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
 * The stored notifications of the user (bazis-notify), refetched by `LiveQuery` on the
 * messages of bazis-notify: a notification of a task opens its card (its `route`).
 */
function Notifications() {
  const notifications = useInbox(ROUTES['notify.notification']);
  const navigate = useNavigate();
  const open = (notification: InboxNotification) => {
    if (notification.route !== null) void navigate(notification.route);
  };
  return <NotificationCenter notifications={notifications} onOpen={open} />;
}

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
    <AppShell
      title={PRODUCT_NAME}
      items={NAVIGATION.map((item) => ({ ...item, label: t(item.label) }))}
      session={LOGIN_ENABLED ? { onLogout } : null}
      // bazis-ws: the lists, the cards and the notifications refetched when they change
      tools={
        <>
          <LiveQuery />
          <Notifications />
        </>
      }
    >
      <ErrorBoundary resetKey={location.pathname}>
        <Outlet />
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
                    <ErrorBoundary>
                      <LoginScreen />
                    </ErrorBoundary>
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
