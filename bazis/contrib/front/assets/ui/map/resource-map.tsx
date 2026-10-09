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

// The items of a list on a map (`list.map` of a screen): a marker per item with a point in its
// point field, the label of the item as its tooltip, a click opens it (the card of the list).
// It reads the list with the filter of the screen, as `ResourceList` does: the items the user
// may view; the user sees the error of the list in the list.

import { useMemo, type ReactNode } from 'react';

import type { Filter } from '@/bazis/client';
import { useLanguage } from '@/bazis/i18n';
import type { ListPath } from '@/bazis/react';
import { fieldValue, itemLabel, pointOf, useAnyList, type LatLng } from '@/bazis/ui/resource';
import { StatePanel, errorState } from '@/bazis/ui/state-panel';
import { Skeleton } from '@/components/ui/skeleton';

import { LeafletMap, type MapMarker } from './map.js';

/** The items a map reads at most, the first page of its list. */
export const MAP_PAGE = 200;

export interface ResourceMapProps {
  /** The route set (`ROUTES` of the contract). */
  path: ListPath;
  /** The entity of the specs: the map is `map:<entity>`, its markers `marker:<id>`. */
  entity: string;
  /** The point field of the items (`type: point` of the specs). */
  field: string;
  /** The filter of the screen (`list.filter`), or of what is near (`nearFilter`). */
  filter?: Filter | undefined;
  /**
   * The order of the items read (`sort`), the first `pageSize` of them: the distance from a
   * point once the core sorts by it.
   */
  sort?: readonly string[] | undefined;
  pageSize?: number;
  /** A click on the marker of an item. */
  onOpen?: ((id: string) => void) | undefined;
  /** The open item, drawn larger. */
  selected?: string | null | undefined;
  /** The position of the user (`useGeolocation`), drawn apart. */
  me?: LatLng | null | undefined;
  /** Under the map when no item has a point. */
  emptyMessage?: ReactNode;
  className?: string | undefined;
}

/**
 * A map of the items of a list with a point (`map:<entity>`, `aria-busy` while it loads), the
 * markers `marker:<id>` opening the items.
 */
export function ResourceMap({
  path,
  entity,
  field,
  filter,
  sort,
  pageSize = MAP_PAGE,
  onOpen,
  selected,
  me,
  emptyMessage,
  className,
}: ResourceMapProps) {
  const { t } = useLanguage();
  const list = useAnyList(path, {
    ...(filter ? { filter } : {}),
    ...(sort?.length ? { sort } : {}),
    page: { limit: pageSize },
  });
  const markers = useMemo<MapMarker[]>(
    () =>
      (list.data?.data ?? []).flatMap((item) => {
        const point = pointOf(fieldValue(item, field));
        return point ? [{ id: item.id, point, label: itemLabel(item) }] : [];
      }),
    [list.data, field],
  );
  if (list.isPending) {
    return (
      <div data-bz={`map:${entity}`} aria-busy="true" className={className}>
        <Skeleton className="h-72 w-full rounded-xl sm:h-96" />
      </div>
    );
  }
  if (list.isError) {
    return <StatePanel inline state={errorState(list.error)} error={list.error} />;
  }
  return (
    <div className="grid gap-2">
      <LeafletMap data-bz={`map:${entity}`} markers={markers} selected={selected} onOpen={onOpen} me={me} className={className} />
      {markers.length === 0 && <p className="text-sm text-muted-foreground">{emptyMessage ?? t('map.empty')}</p>}
    </div>
  );
}
