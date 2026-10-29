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

import { choiceLabel, objectFields, resourceSchema, startValue } from '../src/schema.js';
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
          nullable: false, type: 'string', format: null, enum: null, labels: null, blank: false, relation: null,
          schema: expect.objectContaining({ maxLength: 255 }) as unknown,
        },
        {
          kind: 'attribute', name: 'report', title: 'Report', required: false, readOnly: false,
          nullable: false, type: 'string', format: null, enum: null, labels: null, blank: false, relation: null,
          schema: expect.objectContaining({ default: '' }) as unknown,
        },
        // choices, with their labels in the language of the request (`enumDict`)
        {
          kind: 'attribute', name: 'priority', title: 'Priority', required: false, readOnly: false,
          nullable: false, type: 'string', format: null, enum: ['low', 'normal', 'high'],
          labels: { low: 'Low', normal: 'Normal', high: 'High' }, blank: false, relation: null,
          schema: expect.objectContaining({ default: 'normal' }) as unknown,
        },
        // a PointField: its GeoJSON object (the contract says that it is a point)
        {
          kind: 'attribute', name: 'location', title: 'Location', required: false, readOnly: false,
          nullable: true, type: 'object', format: null, enum: null, labels: null, blank: false, relation: null,
          schema: expect.objectContaining({ required: ['type', 'coordinates'] }) as unknown,
        },
        // a nullable date and time
        {
          kind: 'attribute', name: 'due', title: 'Due', required: false, readOnly: false,
          nullable: true, type: 'string', format: 'date-time', enum: null, labels: null, blank: false, relation: null,
          schema: expect.objectContaining({ default: null }) as unknown,
        },
        // a nullable DecimalField: a number or its digits written, a decimal
        {
          kind: 'attribute', name: 'hours', title: 'Hours', required: false, readOnly: false,
          nullable: true, type: 'string', format: 'decimal', enum: null, labels: null, blank: false, relation: null,
          schema: expect.objectContaining({ type: 'string', format: 'decimal' }) as unknown,
        },
        // the initial status, which bazis-statusy accepts on a create
        {
          kind: 'relation', name: 'status', title: 'Current status', required: false,
          readOnly: false, nullable: false, relation: 'statusy.status', many: false,
        },
        {
          kind: 'relation', name: 'assignee', title: 'Assignee', required: false, readOnly: false,
          nullable: true, relation: 'users.user', many: false,
        },
        // a file of bazis-uploadable: a relationship to its uploaded files
        {
          kind: 'relation', name: 'attachment', title: 'Attachment', required: false, readOnly: false,
          nullable: true, relation: 'uploadable.file_upload', many: false,
        },
        // the files of a many-to-many field: the ids of the uploaded files
        {
          kind: 'relation', name: 'photos', title: 'Photos', required: false, readOnly: false,
          nullable: false, relation: 'uploadable.file_upload', many: true,
        },
        // a many-to-many field: the ids of its related items, optional with `blank=True`
        {
          kind: 'relation', name: 'watchers', title: 'Watchers', required: false, readOnly: false,
          nullable: false, relation: 'users.user', many: true,
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
      ['due', 'attribute', false],
      ['hours', 'attribute', false],
      ['assignee', 'relation', false],
      ['attachment', 'relation', false],
      ['photos', 'relation', false],
      ['watchers', 'relation', false],
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

  it('reads a list schema by its first member, the union of its variants', () => {
    // bazis-permit 2.11: `anyOf[0]` has every field a row may show; the other members, the
    // combinations of the groups of field permissions, have fewer
    const item = (attributes: Record<string, unknown>) => ({
      type: 'object',
      properties: {
        type: { type: 'string', default: 'shop.order' },
        attributes: { type: 'object', properties: attributes },
        relationships: { type: 'object', properties: {} },
      },
    });
    const title = { type: 'string', title: 'Title' };
    const total = { type: 'number', title: 'Total' };
    const note = { type: 'string', title: 'Note' };
    const schema = {
      type: 'object',
      properties: {
        data: { type: 'array', items: { anyOf: [item({ title, total, note }), item({ title }), item({ title, note })] } },
      },
    };
    const { type, fields } = resourceSchema(schema);
    expect(type).toBe('shop.order');
    expect(fields.map((it) => [it.name, it.title])).toEqual([['title', 'Title'], ['total', 'Total'], ['note', 'Note']]);
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
        ['due', 'Due', false],
        ['hours', 'Hours', false],
        ['status', 'Current status', false],
        ['status_author', 'status author', false],
        ['assignee', 'Assignee', false],
        ['attachment', 'Attachment', false],
        ['photos', 'Photos', false],
        ['watchers', 'Watchers', false],
      ]);
      expect(fields[0]).toMatchObject({ type: 'string', format: 'date-time' });
      expect(fields[11]).toMatchObject({ kind: 'relation', relation: 'users.user', many: false });
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
    // null of a nullable one; a decimal (a number or a string) is not a URL
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
    expect(price).toMatchObject({ type: 'string', format: 'decimal', blank: false });
    expect(kind).toMatchObject({ type: null, enum: null, blank: false });
    expect(ref).toMatchObject({ type: null, format: null, nullable: false, blank: false });
  });

  it('reads a decimal: a number or a string, with the bounds of the number', () => {
    // `Decimal` of Pydantic (the payload of a transit, the body of a custom action): `gt=0`,
    // nullable; the other unions of a number and a string stay unions
    const fields = objectFields({
      properties: {
        price: { anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'string' }], title: 'Price' },
        hours: { anyOf: [{ type: 'number', minimum: 0, maximum: 24 }, { type: 'string' }, { type: 'null' }], default: null },
        code: { anyOf: [{ type: 'number' }, { type: 'string', format: 'uuid' }] },
        level: { anyOf: [{ type: 'number', enum: [1, 2] }, { type: 'string' }] },
        size: { anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'integer' }] },
      },
      required: ['price'],
    });
    const [price, hours, ...others] = fields;
    expect(price).toMatchObject({ type: 'string', format: 'decimal', nullable: false, required: true, title: 'Price' });
    expect(price?.schema).toEqual({ type: 'string', format: 'decimal', exclusiveMinimum: 0, title: 'Price' });
    expect(hours).toMatchObject({ type: 'string', format: 'decimal', nullable: true });
    expect(hours?.schema).toEqual({ type: 'string', format: 'decimal', minimum: 0, maximum: 24, default: null });
    expect(others.map((it) => [it.type, it.format])).toEqual([[null, null], [null, null], [null, null]]);
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
        nullable: false, type: 'string', format: null, enum: null, labels: null, blank: false, relation: null,
        schema: { title: 'Report', type: 'string' },
      },
      {
        kind: 'attribute', name: 'photos', title: 'Photos', required: false, readOnly: false,
        nullable: false, type: 'array', format: null, enum: null, labels: null, blank: false, relation: null,
        schema: { default: [], items: { type: 'string' }, title: 'Photos', type: 'array' },
      },
    ]);
    expect(objectFields({})).toEqual([]);
  });

  it('reads the resource of the ids of a property of a body from its x-relation', () => {
    // `UploadedFileId` of bazis-uploadable: a string, and a list of them (also by a reference)
    const file = { type: 'string', 'x-relation': 'uploadable.file_upload' };
    const fields = objectFields({
      type: 'object',
      properties: {
        photo: { ...file, title: 'Photo' },
        photos: { type: 'array', items: file, title: 'Photos' },
        scans: { type: 'array', items: { $ref: '#/$defs/File' } },
        cover: { anyOf: [file, { type: 'null' }] },
        tags: { type: 'array', items: { type: 'string' } },
        note: { type: 'string', 'x-relation': 7 },
      },
      $defs: { File: file },
    });
    expect(fields.map((it) => [it.name, it.type, it.relation, it.nullable])).toEqual([
      ['photo', 'string', 'uploadable.file_upload', false],
      ['photos', 'array', 'uploadable.file_upload', false],
      ['scans', 'array', 'uploadable.file_upload', false],
      ['cover', 'string', 'uploadable.file_upload', true],
      ['tags', 'array', null, false],
      ['note', 'string', null, false],
    ]);
  });
});

describe('startValue', () => {
  it('is the default, false for a boolean without choices and without one, else none', () => {
    const [flag, intact, open, kind, note] = objectFields({
      properties: {
        flag: { type: 'boolean', default: true },
        intact: { type: 'boolean' },
        open: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
        kind: { type: 'boolean', enum: [true] },
        note: { type: 'string' },
      },
      required: ['intact'],
    });
    expect([flag, intact, open, kind, note].map((it) => it && startValue(it))).toEqual([true, false, false, undefined, undefined]);
  });
});
