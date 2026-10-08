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

// Type-level tests: checked by `tsc` (npm run typecheck), never run. The hooks are typed by
// the `paths` of the product (here test/fixtures/schema.d.ts).

import { Filter } from '@/bazis/client';

import {
  useCreate,
  useDestroy,
  useFilterFields,
  useItem,
  useList,
  useRelationship,
  useResourceForm,
  useSchema,
  useUpdate,
} from '../src/index.js';
import { useAsyncRequest, useAsyncTask } from '../src/async/index.js';
import { useBgTask } from '../src/bg/index.js';
import { useTransit, useTransits } from '../src/statusy/index.js';
import { useChannel, useSocket } from '../src/ws/index.js';

const PARENT = '/api/v1/entity/parent_entity/';
const CHILD = '/api/v1/entity/child_entity/';
// keeps the checked values used
export const seen: unknown[] = [];

export function useTypedQueries(): void {
  const list = useList(PARENT, { filter: Filter.where('name', 'a'), sort: ['-dt_created'], meta: ['pagination'] });
  const name: string | undefined = list.data?.data[0]?.attributes.name;
  // @ts-expect-error an unknown attribute
  seen.push(list.data?.data[0]?.attributes.no_such_field);
  // @ts-expect-error a list does not accept include
  seen.push(useList(PARENT, { include: ['child_entities'] }));
  // @ts-expect-error an unknown path
  seen.push(useList('/api/v1/entity/no_such_entity/'));

  const item = useItem(PARENT, '1', { include: ['child_entities'] });
  const id: string | undefined = item.data?.data.id;

  seen.push(name, id, useSchema(PARENT, 'create'), useSchema(PARENT, 'update', '1'));
  // @ts-expect-error the schema of an update is that of an item
  seen.push(useSchema(PARENT, 'update'));
  // @ts-expect-error the schema of a create is that of the route set
  seen.push(useSchema(PARENT, 'create', '1'));
  const fields = useFilterFields(CHILD).data?.fields;
  seen.push(fields?.[0]?.py_type);
}

export function useTypedMutations(): void {
  const create = useCreate(PARENT);
  create.mutate({ data: { type: 'entity.parent_entity', attributes: { name: 'a' }, relationships: {} } });
  // @ts-expect-error the attributes are those of the create schema
  create.mutate({ data: { type: 'entity.parent_entity', attributes: { name: 1 }, relationships: {} } });

  const update = useUpdate(PARENT);
  seen.push(update, useDestroy(PARENT), useRelationship(CHILD));
  // @ts-expect-error an item path is not a route set
  seen.push(useDestroy('/api/v1/entity/parent_entity/{item_id}/'));
}

export function useTypedForms(): void {
  const create = useResourceForm(PARENT);
  const update = useResourceForm(PARENT, { id: '1' });
  seen.push(create.values, update.fields);
  void update.submit().then((saved) => {
    seen.push(saved?.data.id);
  });
}

export function useTypedTransits(): void {
  seen.push(useTransits(PARENT, '1').data?.[0]?.payload, useTransit(PARENT, '1'));
  // @ts-expect-error the route set of child_entity is not statusy
  seen.push(useTransits(CHILD, '1'));
}

export function useTypedBackground(): void {
  const task = useBgTask(PARENT, '1');
  const state: 'draft' | 'waiting' | 'starting' | 'running' | 'done' | undefined = task.data?.state;
  // @ts-expect-error a path that is not of the API
  seen.push(state, useBgTask('/api/v1/unknown/', '1'));
  const request = useAsyncRequest();
  request.mutate({ method: 'PATCH', path: `${PARENT}1/`, body: {} });
  // @ts-expect-error a method that bazis-async-request does not take
  request.mutate({ method: 'OPTIONS', path: PARENT });
  const result = useAsyncTask('/api/v1/async_background_response/{task_id}/', null);
  seen.push(result.status, request.data?.status === 'queued' ? request.data.taskId : null);
}

export function useTypedSocket(): void {
  const { status } = useSocket();
  // @ts-expect-error the statuses of the socket
  const closed: typeof status = 'closed';
  useChannel((message: unknown) => {
    seen.push(message, status, closed);
  });
}
