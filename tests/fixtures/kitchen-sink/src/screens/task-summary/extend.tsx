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

// The extension of a generated card (the kitchen sink): a part before it and after it, an
// action in the header, an action of the card next to those of the specs, a value of a field
// of its own and a part under its heading after the generated ones.

import type { ResourceCardProps } from '@/bazis/ui/resource-card';
import type { ScreenExtension } from '@/bazis/ui/screens';
import { Button } from '@/components/ui/button';

export const extension: ScreenExtension<ResourceCardProps> = {
  before: <p data-bz="extension:before">Before the card</p>,
  after: <p data-bz="extension:after">After the card</p>,
  actions: (
    <Button type="button" variant="outline" data-bz="action:print">
      Print
    </Button>
  ),
  props: {
    actions: [{ id: 'archive', label: 'Archive', permission: 'change', onClick: () => undefined }],
    values: { title: (item) => <strong data-bz="extension:value">{item.id}</strong> },
    children: (item, meta) => <p data-bz="extension:children">{meta === undefined ? item.id : 'meta'}</p>,
  },
};
