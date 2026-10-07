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
// and its transits, and the edit through `ResourceForm` in a dialog or in place of the
// screen (`FormSurface`, as the theme composes the forms). Its states are marked
// `state:<state>` (the loading one is the skeleton of the card), its values `field:<name>`.

import { Lock, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { THEME } from '@/bazis/generated/theme';
import type { ItemPath } from '@/bazis/react';
import {
  FieldValue,
  fieldValue,
  isLongText,
  isNumeric,
  itemLabel,
  permitted,
  useAnyItem,
  useItemFields,
  type Fields,
  type ResourceObject,
} from '@/bazis/ui/resource';
import { FormSurface, ResourceFormBody } from '@/bazis/ui/resource-form';
import { queryState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
  /** An edit button (`action:edit`) when the backend allows the change: the form of the update of the fields of the sections. */
  edit?: boolean;
  actions?: readonly CardAction[];
  /** The values of fields, instead of the formatted value. */
  values?: Readonly<Record<string, (item: ResourceObject) => ReactNode>>;
  /**
   * Under the heading: the transits of the item (`TransitBar` of transit-bar), its status
   * history (`StatusHistory` of status-history, which takes the item).
   */
  children?: ReactNode | ((item: ResourceObject) => ReactNode);
  /** The edit in a dialog or as a page; `composition.forms` of the theme by default. */
  forms?: 'dialog' | 'page';
}

/** The skeleton of a card while its item loads. */
function CardSkeleton() {
  return (
    <div className="grid gap-(--space-section)" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid gap-5 rounded-xl border bg-card p-(--space-card) sm:grid-cols-2">
        {[0, 1, 2, 3].map((it) => (
          <div key={it} className="grid gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface SectionsProps {
  sections: readonly CardSection[];
  item: ResourceObject;
  fields: Fields;
  values: Readonly<Record<string, (item: ResourceObject) => ReactNode>>;
  /** Whether the edit changes a field; null: no marks (no edit, or its schema is not loaded). */
  editable: ((name: string) => boolean) | null;
}

/**
 * The sections with the fields that the user may see in the item (`schema_retrieve/`); a
 * section without any is left out. With `editable`, the fields that the edit does not change
 * are marked read-only.
 */
function Sections({ sections, item, fields, values, editable }: SectionsProps) {
  return sections.map((section) => {
    const names = section.fields.filter((name) => fields.has(name));
    if (!names.length) return null;
    return (
      <section
        key={section.id}
        aria-label={typeof section.title === 'string' ? section.title : undefined}
        className="rounded-xl border bg-card text-card-foreground shadow-xs"
      >
        {section.title !== undefined && (
          <h3 className="border-b px-(--space-card) py-3 text-sm font-semibold">{section.title}</h3>
        )}
        <dl className="grid gap-x-8 gap-y-5 p-(--space-card) sm:grid-cols-2">
          {names.map((name) => {
            const field = fields.fields.get(name);
            const readOnly = editable !== null && !editable(name);
            return (
              <div key={name} className={cn('grid min-w-0 content-start gap-1', isLongText(field) && 'sm:col-span-2')}>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span className="first-letter:uppercase">{fields.title(name)}</span>
                  {readOnly && (
                    <span title="Read-only" className="inline-flex text-muted-foreground/70">
                      <Lock className="size-3" aria-hidden="true" />
                      <span className="sr-only">(read-only)</span>
                    </span>
                  )}
                </dt>
                <dd
                  data-bz={`field:${name}`}
                  className={cn('break-words', isLongText(field) && 'whitespace-pre-line', isNumeric(field) && 'tabular-nums')}
                >
                  {values[name]?.(item) ?? <FieldValue field={field} value={fieldValue(item, name)} />}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
    );
  });
}

/** The sections of an item the user may change: the fields of its update (`schema_update/`) mark the others read-only. */
function EditableSections({ path, id, ...props }: Omit<SectionsProps, 'editable'> & { path: string; id: string }) {
  const update = useItemFields(path, id, 'update');
  return (
    <Sections {...props} editable={update.loaded ? (name) => update.fields.get(name)?.readOnly === false : null} />
  );
}

/** The card of an item, with its states, sections, actions and edit. */
export function ResourceCard({
  path,
  id,
  sections,
  title,
  badge,
  edit = false,
  actions = [],
  values = {},
  children,
  forms,
}: ResourceCardProps) {
  const item = useAnyItem(path, id, { meta: ['crud_actions'] });
  const fields = useItemFields(path, id);
  const [editing, setEditing] = useState(false);
  const document = item.data;
  // the sections wait for the titles of their fields
  if (!document || !fields.ready) {
    return (
      <StatePanel
        state={document ? 'loading' : queryState(item)}
        error={item.error}
        onRetry={() => void item.refetch()}
        skeleton={<CardSkeleton />}
      />
    );
  }

  const { data, meta } = document;
  const changeable = edit && permitted(meta, 'change');
  const label = title ? title(data) : itemLabel(data);
  return (
    <article data-bz="state:loaded" className="grid gap-(--space-section)">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {/* the item is the subject of its screen: above the title of the screen */}
          <h2
            className={cn(
              'font-display font-semibold tracking-tight break-words',
              THEME.preset === 'portal' ? 'text-3xl md:text-4xl' : 'text-2xl',
            )}
          >
            {label}
          </h2>
          {badge?.(data)}
        </div>
        <div className="flex flex-wrap gap-2">
          {changeable && (
            <Button
              type="button"
              variant="outline"
              data-bz="action:edit"
              onClick={() => {
                setEditing(true);
              }}
            >
              <Pencil />
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
      {typeof children === 'function' ? children(data) : children}
      {changeable ? (
        <EditableSections path={path} id={id} sections={sections} item={data} fields={fields} values={values} />
      ) : (
        <Sections sections={sections} item={data} fields={fields} values={values} editable={null} />
      )}
      {changeable && (
        <FormSurface
          open={editing}
          {...(forms === undefined ? {} : { mode: forms })}
          title={<>Edit {label}</>}
          onClose={() => {
            setEditing(false);
          }}
        >
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
        </FormSurface>
      )}
    </article>
  );
}
