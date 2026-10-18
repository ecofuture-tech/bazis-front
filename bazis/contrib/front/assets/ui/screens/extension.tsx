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
// that of the props of the component of the screen, `ScreenExtension<ResourceListProps>`,
// so that the screens asset requires none of the components of the primitives.

import type { ReactNode } from 'react';

/** What a product adds to a screen generated from the specs, the component of its primitive with props `P`. */
export interface ScreenExtension<P extends object> {
  /** In the screen, before the component of its primitive. */
  before?: ReactNode;
  /** In the screen, after the component of its primitive. */
  after?: ReactNode;
  /** In the header of the screen, after the actions of the specs. */
  actions?: ReactNode;
  /**
   * Props of the component: the actions (`actions`, `rowActions`, `bulk`) and the `children`
   * come after those of the specs, the others replace them.
   */
  props?: Partial<P>;
}

/** The props that an extension adds to rather than replaces. */
const ADDED: ReadonlySet<string> = new Set(['actions', 'rowActions', 'bulk', 'children']);

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

/**
 * The props of the component of a generated screen with those of its extension: the arrays
 * of the actions joined, the `children` of both, the other props of the extension in place
 * of the generated ones.
 */
export function extended<P extends object>(props: NoInfer<P>, extension: ScreenExtension<P>): P {
  const own = extension.props;
  if (own === undefined) return props;
  const result: Record<string, unknown> = { ...(props as Record<string, unknown>) };
  for (const [name, value] of Object.entries(own)) {
    const generated = result[name];
    if (!ADDED.has(name) || generated === undefined) result[name] = value;
    else if (value === undefined) continue;
    else if (Array.isArray(generated) && Array.isArray(value)) result[name] = [...(generated as unknown[]), ...(value as unknown[])];
    else result[name] = both(generated, value);
  }
  return result as P;
}
