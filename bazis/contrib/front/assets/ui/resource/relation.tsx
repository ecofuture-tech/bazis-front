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

// The related items: their label, and the select of a to-one relationship over the list of
// the related resource (its path from `ROUTES` of the contract).

import type { ComponentProps } from 'react';

import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

import { itemLabel, routeOf, type ResourceObject } from './fields.js';
import { useAnyItem, useAnyList } from './hooks.js';

/** How many related items the select lists. */
const OPTIONS_LIMIT = 100;

function RelatedLabel({ path, id }: { path: string; id: string }) {
  const item = useAnyItem(path, id);
  const data = (item.data as { data?: ResourceObject } | undefined)?.data;
  return <>{data ? itemLabel(data) : id}</>;
}

/**
 * The label of a related item: read from its resource when the contract has a route for
 * it (one request per item, cached), else its id.
 */
export function RelationLabel({ relation, id }: { relation: string; id: string }) {
  const path = routeOf(relation);
  return path ? <RelatedLabel path={path} id={id} /> : <>{id}</>;
}

export interface RelationSelectProps
  extends Omit<ComponentProps<'select'>, 'value' | 'onChange' | 'size'> {
  /** The JSON:API type of the related resource. */
  relation: string;
  /** The id of the related item, null for none. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** The label of the empty option. */
  placeholder?: string;
}

type OptionsProps = Omit<RelationSelectProps, 'relation'> & { path: string };

function RelationOptions({ path, value, onChange, placeholder = '—', ...props }: OptionsProps) {
  const list = useAnyList(path, { page: { limit: OPTIONS_LIMIT } });
  const items = (list.data as { data?: readonly ResourceObject[] } | undefined)?.data ?? [];
  const known = value === null || items.some((it) => it.id === value);
  return (
    <NativeSelect
      {...props}
      className="w-full"
      aria-busy={list.isPending || undefined}
      value={value ?? ''}
      onChange={(event) => {
        onChange(event.target.value || null);
      }}
    >
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {!known && <NativeSelectOption value={value}>{value}</NativeSelectOption>}
      {items.map((item) => (
        <NativeSelectOption key={item.id} value={item.id}>
          {itemLabel(item)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/**
 * A select of the related item of a to-one relationship, over the first items of the list
 * of the related resource; the id in a text input when the contract has no route for it.
 */
export function RelationSelect({ relation, value, onChange, placeholder, ...props }: RelationSelectProps) {
  const path = routeOf(relation);
  if (path) {
    return <RelationOptions {...props} path={path} value={value} onChange={onChange} placeholder={placeholder} />;
  }
  return (
    <Input
      {...(props as ComponentProps<'input'>)}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value || null);
      }}
    />
  );
}
