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

export { useLiveQueries } from './live.js';
export { backgroundStatusOf, changedResource, notificationOf } from './messages.js';
export type { Notification } from './messages.js';
export {
  NOTIFICATIONS_KEPT,
  PING_INTERVAL,
  RECONNECT_MAX,
  RECONNECT_MIN,
  reconnectDelay,
  SocketProvider,
  socketUrl,
  STABLE_AFTER,
  UNAVAILABLE_AFTER,
  useChannel,
  useNotifications,
  useSocket,
} from './socket.js';
export type { SocketProviderProps, SocketStatus } from './socket.js';
