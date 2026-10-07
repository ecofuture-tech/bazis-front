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

// The card of an item over `useItem`: its sections of fields with the titles and the types of
// the retrieve schema, the actions the backend allows (`crud_actions`), a slot for its status
// and its transits, and the inline edit through `ResourceForm`. Its states are marked
// `state:<state>`, its values `field:<name>`.

import { useState, type ReactNode } from 'react';

import type { ItemPath } from '@/bazis/react';
import {
  FieldValue,
  fieldValue,
  itemLabel,
  permitted,
  useAnyItem,
  useItemFields,
  type ResourceObject,
} from '@/bazis/ui/resource';
import { ResourceFormBody } from '@/bazis/ui/resource-form';
import { queryState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** A section of the card: its fields in this order. */
export interface CardSection {
  id: string;
  title?: ReactNode;
  fields: readonly string[];
}

/** An action of the card, a button `action:<id>`, shown when the user may do it on the item. */
export interface CardAction {
  id: string;
  label: ReactNode;
  onClick: () => void;
  permission?: 'change' | 'delete';
  variant?: 'default' | 'outline' | 'destructive';
}

export interface ResourceCardProps {
  /** The route set (`ROUTES` of the contract); for `edit`, one with the update. */
  path: ItemPath;
  id: string;
  sections: readonly CardSection[];
  /** The heading; the label of the item (its name, title...) by default. */
  title?: (item: ResourceObject) => ReactNode;
  /** Next to the heading: the status of the item (`StatusBadge` of status-badge). */
  badge?: (item: ResourceObject) => ReactNode;
  /** An edit button (`action:edit`) when the backend allows the change: the form of the update in place of the sections. */
  edit?: boolean;
  actions?: readonly CardAction[];
  /** The values of fields, instead of the formatted value. */
  values?: Readonly<Record<string, (item: ResourceObject) => ReactNode>>;
  /** Under the heading: the transits of the item (`TransitBar` of transit-bar). */
  children?: ReactNode;
}

/** The card of an item, with its states, sections, actions and inline edit. */
export function ResourceCard({ path, id, sections, title, badge, edit = false, actions = [], values = {}, children }: ResourceCardProps) {
  const item = useAnyItem(path, id, { meta: ['crud_actions'] });
  const fields = useItemFields(path, id);
  const [editing, setEditing] = useState(false);
  const document = item.data;
  if (!document) return <StatePanel state={queryState(item)} error={item.error} onRetry={() => void item.refetch()} />;

  const { data, meta } = document;
  const changeable = edit && permitted(meta, 'change');
  return (
    <article data-bz="state:loaded" className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">{title ? title(data) : itemLabel(data)}</h2>
          {badge?.(data)}
        </div>
        <div className="flex flex-wrap gap-2">
          {changeable && !editing && (
            <Button
              type="button"
              variant="outline"
              data-bz="action:edit"
              onClick={() => {
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )}
          {actions
            .filter((action) => !action.permission || permitted(meta, action.permission))
            .map((action) => (
              <Button
                key={action.id}
                type="button"
                variant={action.variant ?? 'outline'}
                data-bz={`action:${action.id}`}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
        </div>
      </header>
      {children}
      {editing ? (
        <Card>
          <CardContent>
            <ResourceFormBody
              path={path}
              id={id}
              fields={sections.flatMap((section) => section.fields)}
              onSaved={() => {
                setEditing(false);
              }}
              onCancel={() => {
                setEditing(false);
              }}
            />
          </CardContent>
        </Card>
      ) : (
        sections.map((section) => (
          <Card key={section.id} aria-label={typeof section.title === 'string' ? section.title : undefined}>
            {section.title !== undefined && (
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
            )}
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(8rem,max-content)_1fr]">
                {section.fields.map((name) => (
                  <div key={name} className="contents">
                    <dt className="text-sm text-muted-foreground">{fields.title(name)}</dt>
                    <dd data-bz={`field:${name}`} className="break-words">
                      {values[name]?.(data) ?? <FieldValue field={fields.fields.get(name)} value={fieldValue(data, name)} />}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))
      )}
    </article>
  );
}
