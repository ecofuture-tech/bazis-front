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

// The label of a related item, read from the list of its resource (its path from `ROUTES`
// of the contract) with the other related items of the resource that the page shows: the
// rows of a list read the labels of a relationship with one request.

import { Skeleton } from '@/components/ui/skeleton';

import { itemLabel, routeOf } from './fields.js';
import { useAnyRelated } from './hooks.js';

/** An item without a label (the user may not view it): its id, the start of a long one (the whole on hover). */
function UnknownItem({ id }: { id: string }) {
  if (id.length <= 12) return <>{id}</>;
  return (
    <span title={id} className="font-mono text-xs text-muted-foreground">
      #{id.slice(0, 8)}
    </span>
  );
}

function RelatedLabel({ path, id }: { path: string; id: string }) {
  const item = useAnyRelated(path, id);
  if (item.data) return <>{itemLabel(item.data)}</>;
  if (item.isPending) return <Skeleton className="inline-block h-3.5 w-20 align-middle" />;
  return <UnknownItem id={id} />;
}

/**
 * The label of a related item: read from its resource when the contract has a route for it
 * (`useRelatedItem`: the items of a resource shown together are read with one request, and
 * cached), else the start of its id. `path`: the route set of the related resource, instead
 * of its route in `ROUTES`.
 */
export function RelationLabel({ relation, id, path = routeOf(relation) }: { relation: string; id: string; path?: string | undefined }) {
  return path ? <RelatedLabel path={path} id={id} /> : <UnknownItem id={id} />;
}
