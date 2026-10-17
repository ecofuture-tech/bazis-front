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

// The status of an item of bazis-statusy: a badge with its name, `status:<id>`, in the tone
// that `statuses` of spec/design/theme.yaml gives the status (neutral by default).

import { StatusLabel, type ResourceObject } from '@/bazis/ui/resource';

import { statusOf } from './statusy.js';

/** The status of the item (a row of a list or the `data` of an item); nothing without one. */
export function StatusBadge({ resource, className }: { resource: ResourceObject; className?: string }) {
  const status = statusOf(resource);
  if (status === null) return null;
  return <StatusLabel type={resource.type} status={status} className={className} />;
}
