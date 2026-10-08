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

// The live queries of bazis-ws: what the messages of the socket say changed is refetched
// (`useLiveQueries`: a resource by its type in `ROUTES`, a task of bazis-async-background,
// every query after a reconnect), and the state of the socket is shown as a dot,
// `socket:<status>`; when no socket answers (`unavailable`, the socket keeps trying slowly)
// a retry tries at once (`action:reconnect`). Mount it once under `SocketProvider`, in the
// `tools` of `AppShell`.

import { ROUTES } from '@/bazis/generated/contract';
import { useLiveQueries, useSocket, type SocketStatus } from '@/bazis/react/ws';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const SOCKET_LABELS: Readonly<Record<SocketStatus, string>> = {
  idle: 'Live updates off',
  connecting: 'Connecting for live updates',
  open: 'Live updates on',
  rejected: 'Live updates refused: log in again',
  unavailable: 'Live updates unavailable',
};

const DOTS: Readonly<Record<SocketStatus, string>> = {
  idle: 'bg-neutral',
  connecting: 'bg-warning motion-safe:animate-pulse',
  open: 'bg-success',
  rejected: 'bg-danger',
  unavailable: 'bg-danger',
};

export interface LiveQueryProps {
  /** The paths of the resources by their type: `ROUTES` of the contract by default. */
  routes?: Readonly<Record<string, string>>;
}

/** Refetches what the socket says changed; shows the state of the socket. */
export function LiveQuery({ routes = ROUTES }: LiveQueryProps) {
  useLiveQueries(routes);
  const { status, retry } = useSocket();
  return (
    <span className="inline-flex items-center">
      <span
        data-bz={`socket:${status}`}
        role="status"
        title={SOCKET_LABELS[status]}
        className="inline-flex size-8 items-center justify-center"
      >
        <span aria-hidden="true" className={cn('size-2 rounded-full', DOTS[status])} />
        <span className="sr-only">{SOCKET_LABELS[status]}</span>
      </span>
      {status === 'unavailable' && (
        <Button type="button" variant="ghost" size="sm" data-bz="action:reconnect" onClick={retry}>
          Retry
        </Button>
      )}
    </span>
  );
}
