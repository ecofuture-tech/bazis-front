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

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { keys } from '../keys.js';
import { backgroundStatusOf, changedResource } from './messages.js';
import { useChannel, useSocket } from './socket.js';

/**
 * Refetches what the messages of the socket say changed: the queries of a resource
 * (`['bazis', path]`, by its type in `routes`, `ROUTES` of the contract) for
 * `{"resource", "id"}` and a notification about an item, the state of a task of
 * bazis-async-background (`useAsyncTask`) for its status. After a reconnect, every query
 * of the hooks: the messages published while the socket was closed are lost. Only the active
 * queries are refetched; mount it once, under `SocketProvider`.
 */
export function useLiveQueries(routes: Readonly<Record<string, string>>): void {
  const queryClient = useQueryClient();
  const { status } = useSocket();
  const opened = useRef(false);

  useChannel((message) => {
    const background = backgroundStatusOf(message);
    if (background !== null) {
      void queryClient.invalidateQueries({ queryKey: keys.asyncTasks(background.taskId) });
      return;
    }
    const changed = changedResource(message);
    const path = changed === null ? undefined : routes[changed.resource];
    if (path !== undefined) void queryClient.invalidateQueries({ queryKey: keys.resource(path) });
  });

  useEffect(() => {
    if (status !== 'open') return;
    if (opened.current) void queryClient.invalidateQueries({ queryKey: keys.all });
    opened.current = true;
  }, [status, queryClient]);
}
