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

// The status of an item of bazis-statusy: a badge with its name, `status:<id>`.

import { Badge } from '@/components/ui/badge';
import type { ResourceObject } from '@/bazis/ui/resource';

import { statusName, statusOf } from './statusy.js';

/** The status of the item (a row of a list or the `data` of an item); nothing without one. */
export function StatusBadge({ resource }: { resource: ResourceObject }) {
  const status = statusOf(resource);
  if (status === null) return null;
  return (
    <Badge variant="secondary" data-bz={`status:${status}`}>
      {statusName(resource.type, status)}
    </Badge>
  );
}
