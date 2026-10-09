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

// The maps of the points (Leaflet, the npm dependency that `bazis_front add map` sets in
// package.json): the tiles of `MapProvider` (OpenStreetMap by default, with its attribution:
// set those of the product, its tile server and its terms, in production), a marker per point
// in the colors of the theme (the classes of its tokens: the dark mode and the brand follow),
// a button that the keyboard reaches when it opens its item.
// `MapProvider` also gives the forms the map of a point field (`MapPointControl`).

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Filter } from '@/bazis/client';
import { useLanguage } from '@/bazis/i18n';
import { POINT_FIELDS, PointsProvider, type LatLng, type PointControlProps } from '@/bazis/ui/resource';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The tiles of the maps: the URL template of a tile server and its attribution (HTML). */
export interface MapTiles {
  /** `https://tile.openstreetmap.org/{z}/{x}/{y}.png`: `{z}`, `{x}`, `{y}` (and `{s}`) of Leaflet. */
  url: string;
  /** The attribution that the terms of the tiles require, HTML of the product (never of the data). */
  attribution: string;
  maxZoom?: number;
}

/**
 * The tiles of OpenStreetMap, the default: their usage policy allows light use with this
 * attribution; a product in production sets the tiles of its provider (`MapProvider tiles`)
 * and lets their host in its Content Security Policy (`img-src`).
 */
export const OSM_TILES: MapTiles = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
};

const TilesContext = createContext<MapTiles>(OSM_TILES);

/**
 * The tiles of the maps below it, and the map of the point fields in the forms
 * (`FieldInput`: a click places the point). `points`: the point fields by the path of the
 * route set, those of the contract by default.
 */
export function MapProvider({
  tiles = OSM_TILES,
  points = POINT_FIELDS,
  children,
}: {
  tiles?: MapTiles;
  points?: Readonly<Record<string, readonly string[]>>;
  children: ReactNode;
}) {
  return (
    <TilesContext value={tiles}>
      <PointsProvider control={MapPointControl} fields={points}>
        {children}
      </PointsProvider>
    </TilesContext>
  );
}

/** The tiles of the maps (`MapProvider`; OpenStreetMap without one). */
export function useMapTiles(): MapTiles {
  return use(TilesContext);
}

/** Degrees in the decimal notation the core parses (never an exponent), to a tenth of a meter. */
function degrees(value: number): string {
  return String(Number(value.toFixed(6)));
}

/**
 * The filter of the items whose point field is within `meters` of a point (the lookup `near`
 * of the core: `<field>__near=<longitude>,<latitude>,<meters>`), for a list of what is near.
 */
export function nearFilter(field: string, { latitude, longitude }: LatLng, meters: number): Filter {
  return Filter.where(`${field}__near`, [degrees(longitude), degrees(latitude), Math.round(meters)]);
}

/**
 * The sort term of the distance of the point field from a point, the nearest first (`farthest`:
 * the farthest first), the items without a point last: `<field>__distance(<lon>,<lat>)` of
 * the core, for the `sort` of `ResourceList` and `ResourceMap`. Bound it with `nearFilter` on a
 * large list.
 */
export function nearSort(field: string, { latitude, longitude }: LatLng, { farthest = false } = {}): string {
  return `${farthest ? '-' : ''}${field}__distance(${degrees(longitude)},${degrees(latitude)})`;
}

/** The position of the browser, asked for by `locate()`: never saved anywhere. */
export interface Geolocation {
  position: LatLng | null;
  locating: boolean;
  /** The browser has no geolocation, or the user refused it. */
  failed: boolean;
  /** Asks the browser for the position; `then` gets it. */
  locate: (then?: (position: LatLng) => void) => void;
}

/**
 * The position of the user from the browser (`navigator.geolocation`), when `locate()` asks
 * for it: the point of a list of what is near (`nearFilter`, `nearSort`), without a field of
 * the profile.
 */
export function useGeolocation(): Geolocation {
  const [state, setState] = useState<Omit<Geolocation, 'locate'>>({ position: null, locating: false, failed: false });
  const locate = (then?: (position: LatLng) => void) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState((current) => ({ ...current, failed: true }));
      return;
    }
    setState((current) => ({ ...current, locating: true, failed: false }));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { latitude: coords.latitude, longitude: coords.longitude };
        setState({ position, locating: false, failed: false });
        then?.(position);
      },
      () => {
        setState((current) => ({ ...current, locating: false, failed: true }));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  return { ...state, locate };
}

/** A marker of a map: an item at its point. */
export interface MapMarker {
  id: string;
  point: LatLng;
  /** Its name for the screen readers and its tooltip: the label of the item (text). */
  label: string;
}

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

export interface LeafletMapProps {
  markers: readonly MapMarker[];
  /** The marker drawn larger (the open item). */
  selected?: string | null | undefined;
  /** A click on a marker, or Enter or Space on a marker focused with the keyboard. */
  onOpen?: ((id: string) => void) | undefined;
  /** A click on the map elsewhere: its point (the map of a point field). */
  onPick?: ((point: LatLng) => void) | undefined;
  /** The position of the user, drawn apart. */
  me?: LatLng | null | undefined;
  className?: string | undefined;
  'data-bz'?: string | undefined;
}

/** What the view of a map is fitted to: the ids and the points of its markers, and the position of the user. */
function placementOf(markers: readonly MapMarker[], me: LatLng | null | undefined): string {
  return JSON.stringify([markers.map(({ id, point }) => [id, point.latitude, point.longitude]), me ? [me.latitude, me.longitude] : null]);
}

/**
 * A Leaflet map with a marker per point (`marker:<id>`, a button with the label as its name and
 * its title when it opens the item: the keyboard reaches it), fitted to them when they change
 * (not when another one is selected); the tiles of `MapProvider`.
 */
export function LeafletMap({ markers, selected, onOpen, onPick, me, className, 'data-bz': mark }: LeafletMapProps) {
  const { t } = useLanguage();
  const tiles = useMapTiles();
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
      // under the popovers and the dialogs of the screen
      className={cn('z-0 h-72 w-full overflow-hidden rounded-xl border bg-muted sm:h-96', className)}
    />
  );
}

/**
 * The map of a point field in a form (the control that `MapProvider` gives `FieldInput`): the
 * point as a marker, a click places it, the button places the position of the browser.
 */
export function MapPointControl({ field, value, onChange, disabled }: PointControlProps) {
  const { t } = useLanguage();
  const geolocation = useGeolocation();
  // by its value: the point of the field is a new object at every render of the form
  const latitude = value?.latitude;
  const longitude = value?.longitude;
  const markers = useMemo(
    () => (latitude !== undefined && longitude !== undefined ? [{ id: field.name, point: { latitude, longitude }, label: field.title }] : []),
    [latitude, longitude, field.name, field.title],
  );
  return (
    <div className="grid gap-2" data-bz={`map:${field.name}`}>
      <LeafletMap
        markers={markers}
        className="h-56 sm:h-64"
        onPick={
          disabled
            ? undefined
            : (point) => {
                onChange(point);
              }
        }
      />
      {!disabled && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{geolocation.failed ? t('map.locate_failed') : t('map.pick')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={geolocation.locating}
            onClick={() => {
              geolocation.locate(onChange);
            }}
            data-bz={`action:locate-${field.name}`}
          >
            <LocateFixed />
            {t('map.locate')}
          </Button>
        </div>
      )}
    </div>
  );
}
