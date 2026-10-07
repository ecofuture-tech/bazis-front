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

// The statuses and the transits of bazis-statusy by the JSON:API type of their model, from
// `TRANSITS` of the contract: their names in the language of the backend.

import { TRANSITS } from '@/bazis/generated/contract';
import { fieldValue, type ResourceObject } from '@/bazis/ui/resource';

interface Named {
  id: string;
  name: string;
}

interface StatusyModel {
  statuses: readonly Named[];
  transits: readonly Named[];
}

function model(type: string): StatusyModel | undefined {
  return (TRANSITS as Readonly<Record<string, StatusyModel | undefined>>)[type];
}

/** The status of an item of a statusy model: the id of its relationship `status`. */
export function statusOf(resource: ResourceObject): string | null {
  const status = fieldValue(resource, 'status');
  return typeof status === 'string' ? status : null;
}

/** The name of a status of the model; its id when the contract does not have it. */
export function statusName(type: string, status: string): string {
  return model(type)?.statuses.find((it) => it.id === status)?.name ?? status;
}

/** The name of a transit of the model; its id when the contract does not have it. */
export function transitName(type: string, transit: string): string {
  return model(type)?.transits.find((it) => it.id === transit)?.name ?? transit;
}

/** The statuses of the model as the options of a filter (`filters` of resource-list). */
export function statusOptions(type: string): { value: string; label: string }[] {
  return (model(type)?.statuses ?? []).map((it) => ({ value: it.id, label: it.name }));
}
