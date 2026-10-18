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
import { Fragment, useState, type ReactNode } from 'react';

import type { PermitMeta } from '@/bazis/client';
import { THEME } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import type { ItemPath } from '@/bazis/react';
import { useScreenPage } from '@/bazis/ui/app-shell';
import {
  FieldValue,
  fieldValue,
  isLongText,
  isNumeric,
  itemLabel,
  itemName,
  permitted,
  useAnyItem,
  useItemFields,
  type FieldDisplay,
  type Fields,
  type ResourceObject,
} from '@/bazis/ui/resource';
import { FormSurface, ResourceFormBody } from '@/bazis/ui/resource-form';
import { queryState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { CardTabs, type CardTab } from './card-tabs.js';

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
  /**
   * The heading; by default the name of the item (`itemName`: its name, title...), else the
   * values of its `label` fields (its id only when none has a value).
   */
  title?: (item: ResourceObject) => ReactNode;
  /**
   * The fields whose values head an item without a name (`label` of the entity of the specs:
   * a loan by its book and its reader); the first two fields of the sections by default, or
   * when it is empty.
   */
  label?: readonly string[];
  /** Next to the heading: the status of the item (`StatusBadge` of status-badge). */
  badge?: (item: ResourceObject) => ReactNode;
  /** An edit button (`action:edit`) when the backend allows the change: the form of the update of the fields of the sections. */
  edit?: boolean;
  actions?: readonly CardAction[];
  /** The values of fields, instead of the formatted value. */
  values?: Readonly<Record<string, (item: ResourceObject) => ReactNode>>;
  /** How the values of fields are shown (`display` of the fields of the entity of the specs). */
  display?: Readonly<Record<string, FieldDisplay>>;
  /**
   * Under the heading: the transits of the item (`TransitBar` of transit-bar), its status
   * history (`StatusHistory` of status-history, which takes the item), a section of the
   * product, given the permission meta of the item (`crud_actions`: `permitted(meta,
   * 'change')`; `custom_actions`: `permitted(meta, 'action_report')`, the button of a custom
   * action of the item) without a request of its own.
   */
  children?: ReactNode | ((item: ResourceObject, meta: PermitMeta | null | undefined) => ReactNode);
  /**
   * The sections and the related content in tabs (`card.tabs` of the specs), under the
   * children; the sections one under the other without.
   */
  tabs?: readonly CardTab[];
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
  display: Readonly<Record<string, FieldDisplay>>;
  /** Whether the edit changes a field; null: no marks (no edit, or its schema is not loaded). */
  editable: ((name: string) => boolean) | null;
}

/**
 * The card heads its screen, a screen without a title (`h1`; its sections and its related
 * lists `h2`); else it is under the title (`h2`, its parts `h3`).
 */
export function useHeadsScreen(): boolean {
  return useScreenPage()?.titled === false;
}

/**
 * The sections with the fields that the user may see in the item (`schema_retrieve/`); a
 * section without any is left out. With `editable`, the fields that the edit does not change
 * are marked read-only.
 */
function Sections({ sections, item, fields, values, display, editable }: SectionsProps) {
  const { t } = useLanguage();
  const Title = useHeadsScreen() ? 'h2' : 'h3';
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
          <Title className="border-b px-(--space-card) py-3 text-sm font-semibold">{section.title}</Title>
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
                    <span title={t('card.readonly')} className="inline-flex">
                      <Lock className="size-3" aria-hidden="true" />
                      <span className="sr-only">({t('card.readonly')})</span>
                    </span>
                  )}
                </dt>
                <dd
                  data-bz={`field:${name}`}
                  className={cn('break-words', isLongText(field) && 'whitespace-pre-line', isNumeric(field) && 'tabular-nums')}
                >
                  {values[name]?.(item) ?? (
                    <FieldValue field={field} value={fieldValue(item, name)} type={item.type} display={display[name]} />
                  )}
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

/**
 * The heading of an item without a name: the values of its fields of `names` that the user
 * sees and that have a value; its id when none has.
 */
function ItemHeading({
  item,
  names,
  fields,
  display,
}: {
  item: ResourceObject;
  names: readonly string[];
  fields: Fields;
  display: Readonly<Record<string, FieldDisplay>>;
}) {
  const shown = names.filter((name) => {
    const value = fieldValue(item, name);
    return fields.has(name) && value !== null && value !== undefined && value !== '';
  });
  if (!shown.length) return <>{itemLabel(item)}</>;
  return shown.map((name, index) => (
    <Fragment key={name}>
      {index > 0 && ' · '}
      <FieldValue field={fields.fields.get(name)} value={fieldValue(item, name)} type={item.type} display={display[name]} />
    </Fragment>
  ));
}

/** The card of an item, with its states, sections, actions and edit. */
export function ResourceCard({
  path,
  id,
  sections,
  title,
  label,
  badge,
  edit = false,
  actions = [],
  values = {},
  display = {},
  children,
  tabs = [],
  forms,
}: ResourceCardProps) {
  const item = useAnyItem(path, id, { meta: ['crud_actions', 'custom_actions'] });
  const fields = useItemFields(path, id);
  const [editing, setEditing] = useState(false);
  const { t } = useLanguage();
  const Heading = useHeadsScreen() ? 'h1' : 'h2';
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
  const heading = title
    ? title(data)
    : (itemName(data) ?? (
        <ItemHeading
          item={data}
          names={label?.length ? label : sections.flatMap((section) => section.fields).slice(0, 2)}
          fields={fields}
          display={display}
        />
      ));
  const body = (shown: readonly CardSection[]) =>
    changeable ? (
      <EditableSections path={path} id={id} sections={shown} item={data} fields={fields} values={values} display={display} />
    ) : (
      <Sections sections={shown} item={data} fields={fields} values={values} display={display} editable={null} />
    );
  return (
    <article data-bz="state:loaded" className="grid gap-(--space-section)">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {/* the item is the subject of its screen: above the title of the screen */}
          <Heading
            className={cn(
              'font-display font-semibold tracking-tight break-words',
              THEME.preset === 'portal' ? 'text-3xl md:text-4xl' : 'text-2xl',
            )}
          >
            {heading}
          </Heading>
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
              {t('card.edit')}
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
      {typeof children === 'function' ? children(data, meta) : children}
      {tabs.length ? <CardTabs tabs={tabs} sections={sections} item={data} meta={meta} render={body} /> : body(sections)}
      {changeable && (
        <FormSurface
          open={editing}
          {...(forms === undefined ? {} : { mode: forms })}
          title={typeof heading === 'string' ? t('card.edit_item', { item: heading }) : <>{t('card.edit')} {heading}</>}
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
