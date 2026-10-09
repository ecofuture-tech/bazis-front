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

// The points of the models (a `PointField`): the core reads and writes them as GeoJSON,
// `{"type": "Point", "coordinates": [<longitude>, <latitude>]}`, the same object as any other
// geometry; the contract tells the points apart (`format: point` of the field, read from the
// model). `FieldValue` shows a point as its coordinates, `FieldInput` edits a point field as
// the text `<latitude>, <longitude>`, with the control that `PointsProvider` gives it below
// (the map of the component map, `MapProvider`).

import { createContext, use, useMemo, useState, type ComponentType, type ReactNode } from 'react';

import { RESOURCES } from '@/bazis/generated/contract';
import { useLanguage } from '@/bazis/i18n';
import type { AttributeField } from '@/bazis/react';
import { Input } from '@/components/ui/input';

import type { ControlProps } from './files.js';

/** A point: the latitude and the longitude in degrees (WGS 84, SRID 4326). */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** A GeoJSON point, as the backend reads and writes a point field. */
export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [longitude: number, latitude: number];
}

/** The point of a GeoJSON point; null for any other value (another geometry, none). */
export function pointOf(value: unknown): LatLng | null {
  if (typeof value !== 'object' || value === null) return null;
  const { type, coordinates } = value as { type?: unknown; coordinates?: unknown };
  if (type !== 'Point' || !Array.isArray(coordinates)) return null;
  const [longitude, latitude] = coordinates as unknown[];
  return typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : null;
}

/** The GeoJSON of a point, the value of a point field. */
export function geoJsonPoint({ latitude, longitude }: LatLng): GeoJsonPoint {
  return { type: 'Point', coordinates: [longitude, latitude] };
}

/** The coordinates as maps write them, whatever the language: `55.7558, 37.6173` (at most 6 decimals). */
export function formatPoint({ latitude, longitude }: LatLng): string {
  const degrees = (value: number) => String(Number(value.toFixed(6)));
  return `${degrees(latitude)}, ${degrees(longitude)}`;
}

const COORDINATES = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/;

/** The point of the text `<latitude>, <longitude>` (or separated by a space or `;`); null when it is not one. */
export function parsePoint(text: string): LatLng | null {
  const match = COORDINATES.exec(text);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}

type ContractResource = {
  readonly path?: string;
  readonly other_routes?: readonly { readonly path: string }[];
  readonly fields?: Readonly<Record<string, { readonly format?: string } | undefined>>;
};

/** The point fields of the contract (`format: point`) by the path of each route set of their resource. */
export const POINT_FIELDS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.values(RESOURCES as Readonly<Record<string, ContractResource>>).flatMap((resource) => {
    const names = Object.entries(resource.fields ?? {})
      .filter(([, field]) => field?.format === 'point')
      .map(([name]) => name);
    const paths = [resource.path, ...(resource.other_routes ?? []).map((it) => it.path)];
    return names.length ? paths.flatMap((path) => (path ? [[path, names] as const] : [])) : [];
  }),
);

/** What `FieldInput` gives the control of a point field (the map of `MapProvider`). */
export interface PointControlProps {
  field: AttributeField;
  /** The point of the field; null for none. */
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
  disabled: boolean;
}

interface Points {
  /** The point fields by the path of the route set. */
  fields: Readonly<Record<string, readonly string[]>>;
  /** The control under the coordinates of a point field in the forms; null: the coordinates alone. */
  control: ComponentType<PointControlProps> | null;
}

const PointsContext = createContext<Points>({ fields: POINT_FIELDS, control: null });

/**
 * Gives `FieldInput` the control of the point fields below it (`MapProvider` of map: a map to
 * place the point). `fields`: those of the contract by default.
 */
export function PointsProvider({
  control,
  fields = POINT_FIELDS,
  children,
}: {
  control: ComponentType<PointControlProps> | null;
  fields?: Readonly<Record<string, readonly string[]>>;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ control, fields }), [control, fields]);
  return <PointsContext value={value}>{children}</PointsContext>;
}

/** The point fields and the control of a point field. */
export function usePoints(): Points {
  return use(PointsContext);
}

/** Whether a field of the route set `path` is a point field (an attribute of `fields`). */
export function isPoint(field: { kind: string; name: string }, path: string | undefined, fields: Points['fields']): boolean {
  return field.kind === 'attribute' && path !== undefined && (fields[path]?.includes(field.name) ?? false);
}

/** The text of the value of a point field in its input. */
function textOf(value: unknown): string {
  const point = pointOf(value);
  if (point) return formatPoint(point);
  return typeof value === 'string' ? value : '';
}

/**
 * The input of a point field: its coordinates as text (`field:<name>`), sent as GeoJSON once
 * they are a point, as the text otherwise (the backend refuses it: the error of the field);
 * the control of `PointsProvider` (a map) below it.
 */
export function PointInput({
  field,
  value,
  onChange,
  disabled,
  control,
}: {
  field: AttributeField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  control: ControlProps;
}) {
  const { t } = useLanguage();
  const Control = usePoints().control;
  const empty = field.nullable ? null : undefined;
  // the text typed, kept while it is not a point; the value set from elsewhere (the map) replaces it
  const [draft, setDraft] = useState(() => ({ value, text: textOf(value) }));
  let text = draft.text;
  if (textOf(value) !== textOf(draft.value)) {
    text = textOf(value);
    setDraft({ value, text });
  }
  const change = (next: unknown, typed: string) => {
    setDraft({ value: next, text: typed });
    onChange(next);
  };
  return (
    <div className="grid gap-2">
      <Input
        {...control}
        inputMode="decimal"
        placeholder={t('point.placeholder')}
        value={text}
        readOnly={field.readOnly}
        disabled={disabled}
        onChange={(event) => {
          const typed = event.target.value;
          const point = parsePoint(typed);
          change(typed.trim() === '' ? empty : point ? geoJsonPoint(point) : typed, typed);
        }}
      />
      {Control !== null && (
        <Control
          field={field}
          value={pointOf(value)}
          disabled={disabled || field.readOnly}
          onChange={(point) => {
            const next = point ? geoJsonPoint(point) : empty;
            change(next, textOf(next));
          }}
        />
      )}
    </div>
  );
}
