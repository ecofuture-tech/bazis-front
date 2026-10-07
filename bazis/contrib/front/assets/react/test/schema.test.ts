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

import { describe, expect, it } from 'vitest';

import { resourceSchema } from '../src/schema.js';
import { parentSchema } from './fixtures/parent.js';
// the runtime schemas of `tasks.task` of the sample of bazis-front, as the backend returns them
import sample from './fixtures/sample.json' with { type: 'json' };

describe('resourceSchema', () => {
  it('reads the create schema of the sample', () => {
    expect(resourceSchema(sample.schema_create)).toEqual({
      type: 'tasks.task',
      fields: [
        {
          kind: 'attribute', name: 'title', title: 'Title', required: true, readOnly: false,
          nullable: false, type: 'string', format: null, enum: null,
          schema: expect.objectContaining({ maxLength: 255 }) as unknown,
        },
        {
          kind: 'attribute', name: 'report', title: 'Report', required: false, readOnly: false,
          nullable: false, type: 'string', format: null, enum: null,
          schema: expect.objectContaining({ default: '' }) as unknown,
        },
        // the initial status, which bazis-statusy accepts on a create
        {
          kind: 'relation', name: 'status', title: 'Current status', required: false,
          readOnly: false, nullable: false, relation: 'statusy.status', many: false,
        },
        {
          kind: 'relation', name: 'assignee', title: 'assignee', required: false, readOnly: false,
          nullable: true, relation: 'users.user', many: false,
        },
      ],
    });
  });

  it('reads the update schema of the sample: no status, nothing required', () => {
    const { type, fields } = resourceSchema(sample.schema_update);
    expect(type).toBe('tasks.task');
    expect(fields.map((it) => [it.name, it.kind, it.required])).toEqual([
      ['title', 'attribute', false],
      ['report', 'attribute', false],
      ['assignee', 'relation', false],
    ]);
  });

  it('reads nullable, choices, read-only and to-many fields', () => {
    const fields = Object.fromEntries(
      resourceSchema(parentSchema('create')).fields.map((it) => [it.name, it]),
    );
    expect(fields.price).toMatchObject({ type: 'number', nullable: true, required: false });
    expect(fields.state).toMatchObject({ type: 'string', enum: ['new', 'done'], title: 'State' });
    expect(fields.is_active).toMatchObject({ type: 'boolean', nullable: false });
    expect(fields.dt_created).toMatchObject({ readOnly: true, format: 'date-time' });
    expect(fields.parent).toMatchObject({ relation: 'entity.parent_entity', many: false, nullable: true });
    expect(fields.child_entities).toMatchObject({ relation: 'entity.child_entity', many: true, nullable: false });
  });

  it('reads no fields from what is not a resource schema', () => {
    expect(resourceSchema({})).toEqual({ type: '', fields: [] });
  });
});
