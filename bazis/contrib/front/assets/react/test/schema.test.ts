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

import { choiceLabel, objectFields, resourceSchema } from '../src/schema.js';
import { transits } from '../src/statusy/transits.js';
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
          nullable: false, type: 'string', format: null, enum: null, labels: null, blank: false,
          schema: expect.objectContaining({ maxLength: 255 }) as unknown,
        },
        {
          kind: 'attribute', name: 'report', title: 'Report', required: false, readOnly: false,
          nullable: false, type: 'string', format: null, enum: null, labels: null, blank: false,
          schema: expect.objectContaining({ default: '' }) as unknown,
        },
        // choices, with their labels in the language of the request (`enumDict`)
        {
          kind: 'attribute', name: 'priority', title: 'Priority', required: false, readOnly: false,
          nullable: false, type: 'string', format: null, enum: ['low', 'normal', 'high'],
          labels: { low: 'Low', normal: 'Normal', high: 'High' }, blank: false,
          schema: expect.objectContaining({ default: 'normal' }) as unknown,
        },
        // a PointField: its GeoJSON object (the contract says that it is a point)
        {
          kind: 'attribute', name: 'location', title: 'Location', required: false, readOnly: false,
          nullable: true, type: 'object', format: null, enum: null, labels: null, blank: false,
          schema: expect.objectContaining({ required: ['type', 'coordinates'] }) as unknown,
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
        // a file of bazis-uploadable: a relationship to its uploaded files
        {
          kind: 'relation', name: 'attachment', title: 'Attachment', required: false, readOnly: false,
          nullable: true, relation: 'uploadable.file_upload', many: false,
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
      ['priority', 'attribute', false],
      ['location', 'attribute', false],
      ['assignee', 'relation', false],
      ['attachment', 'relation', false],
    ]);
  });

  it('reads nullable, choices, read-only and to-many fields', () => {
    const fields = Object.fromEntries(
      resourceSchema(parentSchema('create')).fields.map((it) => [it.name, it]),
    );
    expect(fields.price).toMatchObject({ type: 'number', nullable: true, required: false });
    expect(fields.state).toMatchObject({
      type: 'string', enum: ['new', 'done'], labels: { new: 'New', done: 'Done' }, title: 'State',
    });
    expect(fields.name).toMatchObject({ enum: null, labels: null });
    expect(fields.is_active).toMatchObject({ type: 'boolean', nullable: false });
    expect(fields.dt_created).toMatchObject({ readOnly: true, format: 'date-time' });
    expect(fields.parent).toMatchObject({ relation: 'entity.parent_entity', many: false, nullable: true });
    expect(fields.child_entities).toMatchObject({ relation: 'entity.child_entity', many: true, nullable: false });
  });

  it('reads the list and the retrieve schemas of the sample: what the user may see', () => {
    for (const schema of [sample.schema_list, sample.schema_retrieve]) {
      const { type, fields } = resourceSchema(schema);
      expect(type).toBe('tasks.task');
      expect(fields.map((it) => [it.name, it.title, it.readOnly])).toEqual([
        ['dt_created', 'Creation time', true],
        ['dt_updated', 'Update time', true],
        ['status_dt', 'Status timestamp', true],
        ['title', 'Title', false],
        ['report', 'Report', false],
        ['priority', 'Priority', false],
        ['location', 'Location', false],
        ['status', 'Current status', false],
        ['status_author', 'status author', false],
        ['assignee', 'assignee', false],
        ['attachment', 'Attachment', false],
      ]);
      expect(fields[0]).toMatchObject({ type: 'string', format: 'date-time' });
      expect(fields[9]).toMatchObject({ kind: 'relation', relation: 'users.user', many: false });
      expect(fields[5]).toMatchObject({ labels: { low: 'Low', normal: 'Normal', high: 'High' } });
    }
  });

  it('reads the labels of the choices of a nullable field, and gives them by value', () => {
    // `enumDict` next to `anyOf` and `enum`, as the core writes a nullable field with choices
    const { fields } = resourceSchema({
      properties: {
        data: {
          properties: {
            attributes: {
              properties: {
                level: {
                  anyOf: [{ type: 'integer' }, { type: 'null' }],
                  enum: [1, 2],
                  enumDict: { '1': 'Low', '2': 'High', '3': 7 },
                  nullable: true,
                  title: 'Level',
                },
              },
            },
          },
        },
      },
    });
    const [level] = fields;
    expect(level).toMatchObject({ type: 'integer', enum: [1, 2], labels: { '1': 'Low', '2': 'High' }, nullable: true });
    expect([choiceLabel(level, 1), choiceLabel(level, '2'), choiceLabel(level, 3), choiceLabel(level, null)]).toEqual([
      'Low', 'High', null, null,
    ]);
    expect(choiceLabel(undefined, 1)).toBeNull();
  });

  it('reads a URL field: the URL, the empty string allowed', () => {
    // a `URLField` of the core (bazis 2.16): the URL or the empty string (`blank=True`), the
    // null of a nullable one; a decimal (a number or a string) stays a union
    const url = (nullable: boolean) => ({
      anyOf: [
        { type: 'string', format: 'uri', minLength: 1, maxLength: 200 },
        { type: 'string', maxLength: 0 },
        ...(nullable ? [{ type: 'null' }] : []),
      ],
      title: 'Site',
    });
    const { fields } = resourceSchema({
      properties: {
        data: {
          properties: {
            attributes: {
              properties: {
                site: url(false),
                link: url(true),
                only: { anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] },
                price: { anyOf: [{ type: 'number' }, { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' }] },
                // two enums, a string or a UUID: no empty string among them
                kind: { anyOf: [{ $ref: '#/$defs/Color' }, { $ref: '#/$defs/Size' }] },
                ref: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'string' }, { type: 'null' }] },
              },
            },
          },
        },
      },
      $defs: { Color: { type: 'string', enum: ['red', 'blue'] }, Size: { type: 'string', enum: ['s', 'm'] } },
    });
    const [site, link, only, price, kind, ref] = fields;
    expect(site).toMatchObject({ type: 'string', format: 'uri', nullable: false, blank: true, title: 'Site' });
    expect(site?.kind === 'attribute' && site.schema).toMatchObject({ maxLength: 200, minLength: 1 });
    expect(link).toMatchObject({ type: 'string', format: 'uri', nullable: true, blank: true });
    expect(only).toMatchObject({ type: 'string', format: 'uri', nullable: true, blank: false });
    expect(price).toMatchObject({ type: null, format: null, blank: false });
    expect(kind).toMatchObject({ type: null, enum: null, blank: false });
    expect(ref).toMatchObject({ type: null, format: null, nullable: false, blank: false });
  });

  it('reads no fields from what is not a resource schema', () => {
    expect(resourceSchema({})).toEqual({ type: '', fields: [] });
  });
});

describe('objectFields', () => {
  it('reads the payload of a transit as attributes', () => {
    const payload = transits(sample.retrieve_in_progress)[0]?.payload ?? {};
    expect(objectFields(payload)).toEqual([
      {
        kind: 'attribute', name: 'report', title: 'Report', required: true, readOnly: false,
        nullable: false, type: 'string', format: null, enum: null, labels: null, blank: false,
        schema: { title: 'Report', type: 'string' },
      },
    ]);
    expect(objectFields({})).toEqual([]);
  });
});
