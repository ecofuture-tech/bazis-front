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

import { createContext, use, useMemo, type ReactNode } from 'react';

import type { BazisClient } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

/** The client of the backend, typed by the generated `paths`. */
export type Api = BazisClient<paths>;

interface Bazis {
  api: Api;
  session: string;
}

const BazisContext = createContext<Bazis | null>(null);

export interface BazisProviderProps {
  /** The client of the backend (`createClient<paths>()`). */
  client: Api;
  /**
   * The current session: a value that changes whenever a user logs in or out, such as a
   * number of the session (never the token). Every query key of the hooks ends with it, so
   * that what one user loaded is never shown to another.
   */
  session: string;
  children: ReactNode;
}

/** Gives the hooks the client and the session; inside the `QueryClientProvider`. */
export function BazisProvider({ client, session, children }: BazisProviderProps) {
  const value = useMemo(() => ({ api: client, session }), [client, session]);
  return <BazisContext value={value}>{children}</BazisContext>;
}

export function useBazis(): Bazis {
  const bazis = use(BazisContext);
  if (bazis === null) throw new Error('The hooks of Bazis need a <BazisProvider>.');
  return bazis;
}

/** The client of the backend. */
export function useApi(): Api {
  return useBazis().api;
}

/**
 * The session of `BazisProvider`: the last item of the key of a query of the product's own
 * that reads data of the current user.
 */
export function useSessionKey(): string {
  return useBazis().session;
}
