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

// A runtime schema of `parent_entity` in the shape of those of Bazis (Pydantic, with
// `$defs`; see the real ones of the sample in fixtures/sample.json): attributes with a
// nullable number, a default, choices and a read-only field; a to-one and a to-many
// relationship.

const identifier = (type: string) => ({
  properties: {
    id: { default: null, title: 'Id', type: 'string' },
    type: { default: type, title: 'Type', type: 'string' },
  },
  type: 'object',
});

export function parentSchema(action: 'create' | 'update') {
  return {
    $defs: {
      Attributes: {
        properties: {
          name: { maxLength: 255, nullable: false, title: 'Name', type: 'string' },
          price: {
            anyOf: [{ type: 'number' }, { type: 'null' }],
            default: null,
            nullable: true,
            title: 'Price',
          },
          is_active: { default: true, nullable: false, title: 'Active', type: 'boolean' },
          state: { $ref: '#/$defs/State', default: 'new', title: 'State' },
          dt_created: { format: 'date-time', readOnly: true, title: 'Created', type: 'string' },
        },
        ...(action === 'create' ? { required: ['name'] } : {}),
        type: 'object',
      },
      State: { enum: ['new', 'done'], title: 'State', type: 'string' },
      Relationships: {
        properties: {
          parent: {
            anyOf: [{ $ref: '#/$defs/ParentData' }, { type: 'null' }],
            default: null,
            nullable: true,
            title: 'Parent',
          },
          child_entities: { $ref: '#/$defs/ChildrenData', blank: true, nullable: false, title: 'Children' },
        },
        type: 'object',
      },
      ParentData: {
        properties: {
          data: { anyOf: [{ $ref: '#/$defs/ParentIdentifier' }, { type: 'null' }], title: 'Data' },
        },
        type: 'object',
      },
      ParentIdentifier: identifier('entity.parent_entity'),
      ChildrenData: {
        properties: {
          data: {
            anyOf: [{ items: { $ref: '#/$defs/ChildIdentifier' }, type: 'array' }, { type: 'null' }],
            blank: true,
            nullable: false,
            title: 'Data',
          },
        },
        type: 'object',
      },
      ChildIdentifier: identifier('entity.child_entity'),
      Resource: {
        properties: {
          id: { format: 'uuid', title: 'Id', type: 'string' },
          type: { default: 'entity.parent_entity', title: 'Type', type: 'string' },
          'bs:action': { default: action === 'create' ? 'add' : 'change', type: 'string' },
          attributes: { $ref: '#/$defs/Attributes', title: 'Attributes' },
          relationships: { $ref: '#/$defs/Relationships', title: 'Relationships' },
        },
        required: action === 'create' ? ['attributes', 'relationships'] : ['id', 'attributes', 'relationships'],
        type: 'object',
      },
    },
    properties: { data: { $ref: '#/$defs/Resource', title: 'Data' } },
    required: ['data'],
    type: 'object',
  };
}
