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

// The Leaflet map of `LeafletMap` (map.tsx), a chunk of its own with Leaflet and its styles:
// loaded when a map is first shown, so that the screens without a map do not load Leaflet.

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

import { useLanguage } from '@/bazis/i18n';
import type { LatLng } from '@/bazis/ui/resource';
import { cn } from '@/lib/utils';

import { useMapTiles, type LeafletMapProps, type MapMarker } from './map.js';

/** The view of a map without markers: the world. */
const WORLD = { center: [20, 0] as L.LatLngTuple, zoom: 2 };

/** The icon of a marker: a dot in the colors of the theme, larger for the open item. */
function markerIcon(kind: 'item' | 'selected' | 'me'): L.DivIcon {
  const size = kind === 'selected' ? 22 : kind === 'me' ? 14 : 16;
  return L.divIcon({
    html: '',
    iconSize: [size, size],
    className: cn(
      'rounded-full border-2 border-background shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
      kind === 'me' ? 'bg-info' : 'bg-primary',
    ),
  });
}

/** What the view of a map is fitted to: the ids and the points of its markers, and the position of the user. */
function placementOf(markers: readonly MapMarker[], me: LatLng | null | undefined): string {
  return JSON.stringify([markers.map(({ id, point }) => [id, point.latitude, point.longitude]), me ? [me.latitude, me.longitude] : null]);
}

/** `LeafletMap` once Leaflet is loaded. */
export default function LeafletView({ markers, selected, onOpen, onPick, me, tiles: own, className, 'data-bz': mark }: LeafletMapProps) {
  const { t } = useLanguage();
  const provided = useMapTiles();
  const tiles = own ?? provided;
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const handlers = useRef({ onOpen, onPick });
  useEffect(() => {
    handlers.current = { onOpen, onPick };
  }, [onOpen, onPick]);
  const opens = onOpen !== undefined;
  const placement = placementOf(markers, me);

  useEffect(() => {
    if (!element.current) return undefined;
    const created = L.map(element.current, { center: WORLD.center, zoom: WORLD.zoom, scrollWheelZoom: false });
    L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: tiles.maxZoom ?? 19 }).addTo(created);
    layer.current = L.layerGroup().addTo(created);
    created.on('click', (event: L.LeafletMouseEvent) => {
      handlers.current.onPick?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });
    map.current = created;
    return () => {
      created.remove();
      map.current = null;
      layer.current = null;
    };
  }, [tiles]);

  // the markers, drawn again when the points, their labels or the position change: a
  // selection only changes their icons (below), so that the focus of the keyboard stays
  const markerLayers = useRef(new Map<string, { marker: L.Marker; selected: boolean }>());
  const drawn = JSON.stringify([placement, markers.map(({ label }) => label)]);
  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    markerLayers.current.clear();
    const [points, labels] = JSON.parse(drawn) as [string, string[]];
    const [placed, position] = JSON.parse(points) as [[string, number, number][], [number, number] | null];
    placed.forEach(([id, latitude, longitude], index) => {
      const label = labels[index] ?? '';
      // a marker that opens nothing lets a click through to the map (the map of a point field)
      const marker = L.marker([latitude, longitude], {
        icon: markerIcon('item'),
        interactive: opens,
        keyboard: opens,
        title: label,
        riseOnHover: true,
      });
      marker.on('click', () => {
        handlers.current.onOpen?.(id);
      });
      marker.addTo(group);
      markerLayers.current.set(id, { marker, selected: false });
      const icon = marker.getElement();
      icon?.setAttribute('data-bz', `marker:${id}`);
      icon?.setAttribute('aria-label', label);
      // a marker that opens nothing is an image named by its label (Leaflet makes the
      // others buttons)
      if (!opens) icon?.setAttribute('role', 'img');
      icon?.addEventListener('keydown', (event) => {
        if (opens && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          handlers.current.onOpen?.(id);
        }
      });
    });
    if (position) {
      const icon = L.marker(position, { icon: markerIcon('me'), interactive: false, keyboard: false, title: t('map.locate') })
        .addTo(group)
        .getElement();
      icon?.setAttribute('role', 'img');
      icon?.setAttribute('aria-label', t('map.locate'));
    }
  }, [drawn, opens, t, tiles]);

  // the open item larger: `setIcon` of Leaflet keeps the element of a `DivIcon` (and its focus)
  useEffect(() => {
    const drawnMarkers = markerLayers.current;
    for (const [id, { marker, selected: was }] of drawnMarkers) {
      const isSelected = id === selected;
      if (was === isSelected) continue;
      marker.setIcon(markerIcon(isSelected ? 'selected' : 'item'));
      drawnMarkers.set(id, { marker, selected: isSelected });
    }
  }, [selected, drawn, opens, t, tiles]);

  // the view: fitted to the points when they change, kept when one is selected or the screen
  // renders again
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    const [points, position] = JSON.parse(placement) as [[string, number, number][], [number, number] | null];
    const bounds: L.LatLngTuple[] = [...points.map(([, latitude, longitude]): L.LatLngTuple => [latitude, longitude]), ...(position ? [position] : [])];
    const [first] = bounds;
    if (bounds.length === 1 && first) current.setView(first, Math.max(current.getZoom(), 13));
    else if (bounds.length > 1) current.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }, [placement, tiles]);

  return (
    <div
      ref={element}
      role="region"
      aria-label={t('map.label')}
      data-bz={mark}
      // under the popovers and the dialogs of the screen; the zoom of Leaflet within reach of a
      // finger (important: the styles of Leaflet are outside the layers of Tailwind)
      className={cn(
        'z-0 h-72 w-full overflow-hidden rounded-xl border bg-muted sm:h-96',
        'pointer-coarse:[&_.leaflet-bar_a]:size-11! pointer-coarse:[&_.leaflet-bar_a]:leading-11!',
        className,
      )}
    />
  );
}
