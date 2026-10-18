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
// package.json, loaded with the first map shown: `leaflet-map.tsx`): the tiles of `MapProvider` (OpenStreetMap by default, with its attribution:
// set those of the product, its tile server and its terms, in production), a marker per point
// in the colors of the theme (the classes of its tokens: the dark mode and the brand follow),
// a button that the keyboard reaches when it opens its item.
// `MapProvider` also gives the forms the map of a point field (`MapPointControl`).

import { LocateFixed } from 'lucide-react';
import { createContext, lazy, Suspense, use, useMemo, useState, type ReactNode } from 'react';

import { Filter } from '@/bazis/client';
import { useLanguage } from '@/bazis/i18n';
import { POINT_FIELDS, PointsProvider, type LatLng, type PointControlProps } from '@/bazis/ui/resource';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
 * (`FieldInput`: a click places the point). `tiles`: those of a `MapProvider` above it by
 * default (OpenStreetMap without one), so that the tiles of the product are set once around
 * the providers that the screens generate. `points`: the point fields by the path of the
 * route set, those of the contract by default.
 */
export function MapProvider({
  tiles,
  points = POINT_FIELDS,
  children,
}: {
  tiles?: MapTiles | undefined;
  points?: Readonly<Record<string, readonly string[]>>;
  children: ReactNode;
}) {
  const above = use(TilesContext);
  return (
    <TilesContext value={tiles ?? above}>
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
  /** The tiles of this map, over those of `MapProvider`. */
  tiles?: MapTiles | undefined;
  className?: string | undefined;
  'data-bz'?: string | undefined;
}

/** The Leaflet map, a chunk of its own (`leaflet-map.tsx`). */
const LeafletView = lazy(() => import('./leaflet-map.js'));

/**
 * A Leaflet map with a marker per point (`marker:<id>`, a button with the label as its name and
 * its title when it opens the item: the keyboard reaches it), fitted to them when they change
 * (not when another one is selected); its tiles, else those of `MapProvider`. Leaflet is loaded with the
 * first map shown (`aria-busy` meanwhile, and the skeleton `state:loading` in it).
 */
export function LeafletMap(props: LeafletMapProps) {
  return (
    <Suspense
      fallback={
        <div data-bz={props['data-bz']} aria-busy="true" className={cn('h-72 w-full sm:h-96', props.className)}>
          <Skeleton data-bz="state:loading" className="size-full rounded-xl" />
        </div>
      }
    >
      <LeafletView {...props} />
    </Suspense>
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
