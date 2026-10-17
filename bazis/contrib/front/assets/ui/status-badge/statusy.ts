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
// `TRANSITS` of the contract (`statusyModel` of resource): their names in every language of
// the backend (`{en, ru}`), read in the language of the interface; and the tone of a status,
// from `statuses` of spec/design/theme.yaml (`THEME` of the generated theme).

import { LANGUAGE } from '@/bazis/generated/contract';
import { THEME, type Tone } from '@/bazis/generated/theme';
import { fieldValue, localizedName, statusyModel, type ResourceObject } from '@/bazis/ui/resource';

export { statusName } from '@/bazis/ui/resource';

/** The status of an item of a statusy model: the id of its relationship `status`. */
export function statusOf(resource: ResourceObject): string | null {
  const status = fieldValue(resource, 'status');
  return typeof status === 'string' ? status : null;
}

/** The name of a transit of the model in a language; its id when the contract does not have it. */
export function transitName(type: string, transit: string, language: string = LANGUAGE): string {
  return localizedName(statusyModel(type)?.transits.find((it) => it.id === transit), transit, language);
}

/** The statuses of the model as the options of a filter (`filters` of resource-list), named in a language. */
export function statusOptions(type: string, language: string = LANGUAGE): { value: string; label: string }[] {
  return (statusyModel(type)?.statuses ?? []).map((it) => ({ value: it.id, label: localizedName(it, it.id, language) }));
}

/** The tone of a status: `statuses` of the theme, neutral for another. */
export function statusTone(status: string): Tone {
  return THEME.statuses[status] ?? 'neutral';
}

/** The status that a transit of the model leads to; null when the contract does not have it. */
export function transitTarget(type: string, transit: string): string | null {
  return statusyModel(type)?.transits.find((it) => it.id === transit)?.dst ?? null;
}
