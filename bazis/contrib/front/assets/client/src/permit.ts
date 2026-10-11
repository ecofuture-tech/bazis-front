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

/** The access actions of the core (`CrudAccessAction`) checked by bazis-permit. */
export type CrudAccessAction = 'view' | 'change' | 'add' | 'delete' | 'check';

/**
 * A custom action of a route set by its name, `action` of `x-bazis` in the OpenAPI (the
 * method of the route set: `action_export`), as `custom_actions` lists it.
 */
export type CustomActionName = `action_${string}`;

/**
 * The meta fields of a `PermitRouteBase` route, returned when requested with `meta`:
 * on a list `for_change`, `for_delete` (the ids of the page) and `for_create`; on an item
 * (retrieve, create, update) `crud_actions`; `custom_actions` (bazis-permit 2.11) the custom
 * actions the user may call, those of the collection on a list, those of the item on an
 * item, by what they declare (`public`, `access_action`): a check an action makes in its own
 * code is not in it.
 */
export interface PermitMeta {
  for_change?: readonly string[] | null;
  for_delete?: readonly string[] | null;
  for_create?: boolean | null;
  crud_actions?: readonly string[] | null;
  custom_actions?: readonly string[] | null;
}

/**
 * Whether the backend reports the action as allowed for the current user. It only adapts
 * the interface: the backend checks every request itself.
 *
 * - `can(listMeta, 'change' | 'delete', id)`: the item of the page is in `for_change` or
 *   `for_delete`;
 * - `can(itemMeta, action)`: the action is in `crud_actions` of the item;
 * - `can(listMeta, 'add')`: `for_create` of the list;
 * - `can(meta, 'action_<name>')`: the custom action is in `custom_actions` (of the list for
 *   an action of the collection, of the item for an action of an item).
 *
 * False when the meta field was not requested.
 */
export function can(
  meta: PermitMeta | null | undefined,
  action: 'change' | 'delete',
  id: string,
): boolean;
export function can(meta: PermitMeta | null | undefined, action: CrudAccessAction | CustomActionName): boolean;
export function can(
  meta: PermitMeta | null | undefined,
  action: CrudAccessAction | CustomActionName,
  id?: string,
): boolean {
  if (!meta) return false;
  if (action.startsWith('action_')) return meta.custom_actions?.includes(action) ?? false;
  if (id !== undefined) {
    const ids = action === 'change' ? meta.for_change : meta.for_delete;
    return ids?.includes(id) ?? false;
  }
  if (meta.crud_actions) return meta.crud_actions.includes(action);
  return action === 'add' && meta.for_create === true;
}
