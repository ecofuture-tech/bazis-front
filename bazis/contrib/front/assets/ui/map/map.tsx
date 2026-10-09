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
// in the colors of the theme, read when the map is drawn (the dark mode and the brand follow).
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

/**
 * The filter of the items whose point field is within `meters` of a point (the lookup `near`
 * of the core: `<field>__near=<longitude>,<latitude>,<meters>`), for a list of what is near.
 */
export function nearFilter(field: string, { latitude, longitude }: LatLng, meters: number): Filter {
  return Filter.where(`${field}__near`, [longitude, latitude, Math.round(meters)]);
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
 * for it: the point of a list of what is near (`nearFilter`), without a field of the profile.
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
  /** Its tooltip: the label of the item (text). */
  label: string;
}

/** The view of a map without markers: the world. */
const WORLD = { center: [20, 0] as L.LatLngTuple, zoom: 2 };

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export interface LeafletMapProps {
  markers: readonly MapMarker[];
  /** The marker drawn larger (the open item). */
  selected?: string | null | undefined;
  /** A click on a marker. */
  onOpen?: ((id: string) => void) | undefined;
  /** A click on the map elsewhere: its point (the map of a point field). */
  onPick?: ((point: LatLng) => void) | undefined;
  /** The position of the user, drawn apart. */
  me?: LatLng | null | undefined;
  className?: string | undefined;
  'data-bz'?: string | undefined;
}

/**
 * A Leaflet map with a marker per point (`marker:<id>`, the label as its tooltip), fitted to
 * them; the tiles of `MapProvider`.
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

  useEffect(() => {
    const current = map.current;
    const group = layer.current;
    if (!current || !group) return;
    group.clearLayers();
    const primary = token('--primary', 'currentColor');
    const ring = token('--background', 'white');
    const info = token('--info', primary);
    const bounds: L.LatLngTuple[] = [];
    for (const { id, point, label } of markers) {
      const position: L.LatLngTuple = [point.latitude, point.longitude];
      bounds.push(position);
      const marker = L.circleMarker(position, {
        radius: id === selected ? 11 : 8,
        color: ring,
        weight: 2,
        fillColor: primary,
        fillOpacity: id === selected ? 1 : 0.85,
      });
      // the label as text, never as HTML
      const tooltip = document.createElement('span');
      tooltip.textContent = label;
      marker.bindTooltip(tooltip);
      marker.on('click', () => {
        handlers.current.onOpen?.(id);
      });
      marker.addTo(group);
      marker.getElement()?.setAttribute('data-bz', `marker:${id}`);
    }
    if (me) {
      const position: L.LatLngTuple = [me.latitude, me.longitude];
      bounds.push(position);
      L.circleMarker(position, { radius: 7, color: ring, weight: 3, fillColor: info, fillOpacity: 1 })
        .bindTooltip(t('map.locate'))
        .addTo(group);
    }
    const [first] = bounds;
    if (bounds.length === 1 && first) current.setView(first, Math.max(current.getZoom(), 13));
    else if (bounds.length > 1) current.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }, [markers, selected, me, t]);

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
  const markers = useMemo(() => (value ? [{ id: field.name, point: value, label: field.title }] : []), [value, field]);
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
