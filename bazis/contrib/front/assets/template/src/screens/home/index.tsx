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

import { pagination } from '@/bazis/client';
import { RESOURCES } from '@/bazis/generated/contract';
import { useList } from '@/bazis/react';
import { Screen } from '@/bazis/ui/app-shell';

type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];
/** A resource whose route set has a list. */
type Listed = Extract<Resource, { actions: { action_list: 'collection' } }>;

function isListed(resource: Resource): resource is Listed {
  return 'action_list' in resource.actions;
}

/** The number of the items that the user may view. */
function Count({ path }: { path: Listed['path'] }) {
  const list = useList(path, { page: { limit: 1 }, meta: ['pagination'] });
  if (list.isError) return <span title={list.error.message}>—</span>;
  return <span>{list.data ? (pagination(list.data)?.count ?? '—') : '…'}</span>;
}

/** The resources of the backend, from the generated contract. */
export function HomeScreen() {
  return (
    <Screen id="home" title="Resources">
      <ul className="divide-y rounded-lg border">
        {Object.entries(RESOURCES).map(([type, resource]) => (
          <li key={type} className="flex justify-between gap-4 px-4 py-3">
            <span className="font-medium">{type}</span>
            <span className="flex gap-4 text-sm text-muted-foreground">
              <code>{resource.path}</code>
              {isListed(resource) && <Count path={resource.path} />}
            </span>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
