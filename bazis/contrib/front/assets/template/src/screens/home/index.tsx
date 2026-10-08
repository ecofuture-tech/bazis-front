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

import type { UseQueryResult } from '@tanstack/react-query';
import { Database } from 'lucide-react';

import { pagination, type PaginationMeta } from '@/bazis/client';
import { RESOURCES } from '@/bazis/generated/contract';
import { useList, type QueryOptions } from '@/bazis/react';
import { Screen } from '@/bazis/ui/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

// The overview is generic over the resources of the product, as the components are: it reads
// the contract as plain records and lists with plain paths, so that it compiles with any
// contract, also one without resources or without a list (the literal types of `RESOURCES`
// and the list paths of the generated schema are then empty). The screens of a product use
// the typed paths.

/** A resource of the contract, as the overview reads it. */
interface ContractResource {
  path: string;
  actions: Readonly<Record<string, string>>;
}

const resources: Readonly<Record<string, ContractResource>> = RESOURCES;

/** `useList(path, query)` with a plain path. */
const useAnyList = useList as unknown as (
  path: string,
  query: QueryOptions,
) => UseQueryResult<{ meta?: { pagination?: PaginationMeta | null } | null }>;

/** The number of the items that the user may view. */
function Count({ path }: { path: string }) {
  const list = useAnyList(path, { page: { limit: 1 }, meta: ['pagination'] });
  if (list.isPending) return <Skeleton className="h-8 w-12" />;
  if (list.isError) {
    return (
      <span className="text-sm text-muted-foreground" title={list.error.message}>
        Not available
      </span>
    );
  }
  return <span className="text-3xl font-semibold tabular-nums">{pagination(list.data)?.count ?? '—'}</span>;
}

/** The resources of the backend, from the generated contract, with the number of their items. */
export function HomeScreen() {
  return (
    <Screen id="home" title="Overview" description="The resources of the backend and the items you can see.">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(resources).map(([type, resource]) => (
          <li key={type} className="flex flex-col gap-4 rounded-xl border bg-card p-(--space-card) text-card-foreground shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
                <Database className="size-4" aria-hidden="true" />
              </span>
              <div className="grid min-w-0">
                <span className="truncate font-medium">{type}</span>
                <code className="truncate text-xs text-muted-foreground">{resource.path}</code>
              </div>
            </div>
            {'action_list' in resource.actions && <Count path={resource.path} />}
          </li>
        ))}
      </ul>
    </Screen>
  );
}
