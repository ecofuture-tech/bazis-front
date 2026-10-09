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

// A related section of a card (`card.related` of the spec): the items of another resource
// that reference the item of the card by a to-one relationship (the items of a request), as
// a `ResourceList` filtered by it, and "add here": the create form of the related resource
// with the relationship fixed to the item (`ResourceForm` `fixed`), so that the user never
// chooses the item again.

import { Plus } from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';

import { Filter } from '@/bazis/client';
import type { ListPath } from '@/bazis/react';
import type { SavedDocument } from '@/bazis/ui/resource';
import { FormSurface, ResourceFormBody } from '@/bazis/ui/resource-form';
import { ResourceList, type ResourceListProps } from '@/bazis/ui/resource-list';

/** "Add here": the create of a related item from the card. */
export interface RelatedAdd {
  /** The button `action:<id>` that opens the form. */
  id: string;
  label: ReactNode;
  /** The fields of the form (the relationship to the item is fixed and left out). */
  fields?: readonly string[];
  /** The title of the form; the label by default. */
  title?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** Called with the saved item, once the form is closed. */
  onSaved?: (saved: SavedDocument) => void;
}

export interface RelatedListProps
  extends Pick<ResourceListProps, 'columns' | 'onOpen' | 'cells' | 'emptyMessage' | 'sort' | 'pageSize' | 'layout'> {
  /** The route set of the related resource (`ROUTES` of the contract): its list, its create for `add`. */
  path: ListPath;
  /** The entity of the related resource: the list is `list:<entity>`. */
  entity: string;
  /**
   * The to-one relationship of the related resource to the item of the card (`request` of
   * an item of a request): the filter of the list (a field it can be filtered by) and the
   * fixed value of the form.
   */
  relation: string;
  /** The id of the item of the card. */
  item: string;
  /** The heading of the section. */
  title?: ReactNode;
  /**
   * "Add here", shown when the backend allows the create (`for_create` of the list); the
   * screen leaves it out when the item takes no more related items (`permitted(meta,
   * 'change')` of the card: a request that is no longer a draft).
   */
  add?: RelatedAdd | undefined;
  /** The form in a dialog or as a page; `composition.forms` of the theme by default. */
  forms?: 'dialog' | 'page';
}

/** The items of a related resource of the item of a card, and their create from it. */
export function RelatedList({ path, entity, relation, item, title, add, forms, ...list }: RelatedListProps) {
  const [adding, setAdding] = useState(false);
  const close = () => {
    setAdding(false);
  };
  return (
    <section aria-label={typeof title === 'string' ? title : undefined} className="grid gap-3">
      {title !== undefined && <h3 className="font-display text-base font-semibold">{title}</h3>}
      <ResourceList
        {...list}
        path={path}
        entity={entity}
        filter={Filter.where(relation, item)}
        actions={
          add
            ? [
                {
                  id: add.id,
                  label: add.label,
                  icon: add.icon ?? Plus,
                  permission: 'add',
                  onClick: () => {
                    setAdding(true);
                  },
                },
              ]
            : []
        }
      />
      {add && (
        <FormSurface open={adding} {...(forms === undefined ? {} : { mode: forms })} title={add.title ?? add.label} onClose={close}>
          <ResourceFormBody
            path={path}
            {...(add.fields === undefined ? {} : { fields: add.fields })}
            fixed={{ [relation]: item }}
            onSaved={(saved) => {
              close();
              add.onSaved?.(saved);
            }}
            onCancel={close}
          />
        </FormSurface>
      )}
    </section>
  );
}
