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

// The fields of the body of a custom action, read from the contract (its JSON Schema and the
// fields of the resource): those of its dialog (`useCustomAction`) and of its form
// (`ActionForm`). A property named as a relationship of the resource is the picker of its
// related items; another is the attribute of the body (a decimal typed as such).

import { objectFields, type AttributeField, type FormField, type JsonSchema } from '@/bazis/react';
import { FieldInput, fieldTitle, resourceAt, type Fields } from '@/bazis/ui/resource';

/** The values that the fields start with: the defaults of the properties of the body that they ask for. */
export function bodyDefaults(body: JsonSchema | null, names: readonly string[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of objectFields(body ?? {})) {
    if (names.includes(field.name) && 'default' in field.schema) values[field.name] = field.schema.default;
  }
  return values;
}

export interface ActionFieldsProps {
  /** The route set of the entity whose action it is (`ROUTES` of the contract). */
  path: string;
  /** The JSON Schema of the body of the action (`body` of its custom action in the contract). */
  body: JsonSchema;
  /** The properties of the body that it asks for, in this order. */
  names: readonly string[];
  /** The labels of the specs by property (`labels` of the action), before any other title. */
  labels?: Readonly<Record<string, string>> | undefined;
  /**
   * The fields of a runtime schema of the route set that a screen has read (the list of a
   * dialog): the titles and the labels of the choices of the properties named as its fields,
   * in the language of the interface.
   */
  resource?: Fields | undefined;
  values: Readonly<Record<string, unknown>>;
  errors: Readonly<Record<string, readonly string[]>>;
  disabled: boolean;
  onChange: (name: string, value: unknown) => void;
}

/**
 * The field of a property of the body: the picker of the related items of the relationship
 * of the resource of the same name in the contract (`relation`: a text for a to-one one, an
 * array for a to-many one), else the attribute of the body. Its title is the label of the
 * specs, else that of the field of the resource (in the runtime schema of `resource`, else in
 * the contract), else that of the body.
 */
function bodyField(
  path: string,
  property: AttributeField,
  label: string | undefined,
  resource: Fields | undefined,
): FormField {
  const { name } = property;
  const own = resourceAt(path)?.fields[name];
  const runtime = resource?.fields.get(name);
  const title =
    label ?? (resource && runtime ? resource.title(name) : own === undefined ? property.title : fieldTitle(path, name));
  if (own?.relation !== undefined && property.type === (own.many === true ? 'array' : 'string')) {
    const { required, readOnly, nullable } = property;
    return { kind: 'relation', name, title, required, readOnly, nullable, relation: own.relation, many: own.many === true };
  }
  return { ...property, title, labels: runtime?.kind === 'attribute' ? runtime.labels : property.labels };
}

/** The fields of the properties of the body of a custom action that a dialog or a form asks for. */
export function ActionFields({ path, body, names, labels, resource, values, errors, disabled, onChange }: ActionFieldsProps) {
  const properties = objectFields(body);
  return names.map((name) => {
    const property = properties.find((it) => it.name === name);
    if (property === undefined) return null;
    return (
      <FieldInput
        key={name}
        field={bodyField(path, property, labels?.[name], resource)}
        value={values[name]}
        errors={errors[name]}
        disabled={disabled}
        onChange={(value) => {
          onChange(name, value);
        }}
      />
    );
  });
}
