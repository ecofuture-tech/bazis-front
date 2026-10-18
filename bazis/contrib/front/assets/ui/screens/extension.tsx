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

// The extension of a screen generated from the specs (`extend: true`): what the product adds
// to it in `src/screens/<id>/extend.tsx` without editing the generated file. Its type is
// that of the props of the component of the primitive of the screen,
// `ScreenExtension<ResourceListProps>`, so that the screens asset requires none of the
// components of the primitives.

import type { ReactNode } from 'react';

/**
 * The props of the component of a dashboard that are those of its screen (`Dashboard` is the
 * screen): the slots of an extension give them, never its `props`.
 */
type DashboardScreenProps = 'id' | 'title' | 'description' | 'actions' | 'before' | 'children';

/**
 * The props that an extension gives the component of its screen: any of them, but those of
 * the screen for a dashboard, whose component is the screen.
 */
export type ExtensionProps<P extends object> = Partial<
  'tiles' | 'recent' | 'charts' extends keyof P ? Omit<P, DashboardScreenProps> : P
>;

/**
 * What a product adds to a screen generated from the specs (`export const extension` of
 * `src/screens/<id>/extend.tsx`), the component of its primitive with props `P` (and `M`, the
 * map of a list: `ScreenExtension<ResourceListProps, ResourceMapProps>`). It is a constant:
 * what needs a hook (a count, a mutation, a translated text) is a component of the product,
 * rendered in a slot or by a render prop.
 */
export interface ScreenExtension<P extends object, M extends object = object> {
  /** In the screen, before the component of its primitive (and the map of a list). */
  before?: ReactNode;
  /** In the screen, after the component of its primitive (before the forms of its actions). */
  after?: ReactNode;
  /** In the header of the screen, after the actions of the specs: on every primitive, a dashboard too. */
  actions?: ReactNode;
  /**
   * Props of the component of the primitive, merged with those of the specs (`extended`): the
   * lists of actions and of tiles by their `id`, the records of the fields by field, the
   * `children` of both; the other props replace the generated ones.
   */
  props?: ExtensionProps<P>;
  /** Props of the map beside a list (`list.map`), merged the same way. */
  map?: Partial<M>;
}

/**
 * The lists merged by the `id` of their items: an item of the extension replaces the
 * generated one with its id, in its place; the others follow the generated ones.
 */
const BY_ID: ReadonlySet<string> = new Set(['actions', 'rowActions', 'bulk', 'tiles']);
/** The records of the fields, merged by field: a field of the extension replaces the generated one. */
const BY_FIELD: ReadonlySet<string> = new Set(['cells', 'values', 'display']);

/** Both contents, the generated one first; of render props, both called with the same arguments. */
function both(generated: unknown, added: unknown): unknown {
  if (typeof generated !== 'function' && typeof added !== 'function') {
    return (
      <>
        {generated as ReactNode}
        {added as ReactNode}
      </>
    );
  }
  const render = (it: unknown, args: unknown[]) =>
    (typeof it === 'function' ? (it as (...values: unknown[]) => ReactNode)(...args) : it) as ReactNode;
  return (...args: unknown[]) => (
    <>
      {render(generated, args)}
      {render(added, args)}
    </>
  );
}

/** The generated items with those of the extension, by their id. */
function byId(generated: readonly { id: string }[], added: readonly { id: string }[]): readonly { id: string }[] {
  const replacing = new Map(added.map((it) => [it.id, it]));
  const ids = new Set(generated.map((it) => it.id));
  return [...generated.map((it) => replacing.get(it.id) ?? it), ...added.filter((it) => !ids.has(it.id))];
}

/**
 * The props of the component of a generated screen with those of its extension: the lists of
 * actions and of tiles (`actions`, `rowActions`, `bulk`, `tiles`) by the `id` of their items,
 * the records of the fields (`cells`, `values`, `display`) by field, the `children` of both,
 * the generated ones first; the other props of the extension replace the generated ones (an
 * undefined one too, but of a merged prop, which keeps the generated one).
 */
export function extended<P extends object>(props: P, added: ExtensionProps<P> | undefined): P {
  if (added === undefined) return props;
  const result: Record<string, unknown> = { ...(props as Record<string, unknown>) };
  for (const [name, value] of Object.entries(added as Record<string, unknown>)) {
    const generated = result[name];
    if (generated === undefined || !(BY_ID.has(name) || BY_FIELD.has(name) || name === 'children')) {
      result[name] = value;
    } else if (value === undefined) {
      continue;
    } else if (name === 'children') {
      result[name] = both(generated, value);
    } else if (BY_FIELD.has(name)) {
      result[name] = { ...(generated as object), ...(value as object) };
    } else if (Array.isArray(generated) && Array.isArray(value)) {
      result[name] = byId(generated as { id: string }[], value as { id: string }[]);
    } else {
      result[name] = value;
    }
  }
  return result as P;
}
