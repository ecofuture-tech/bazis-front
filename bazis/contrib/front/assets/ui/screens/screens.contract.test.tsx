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

// The contract of what the generated screens use: the create form of an action, opened from a
// button or with fixed values, sent, closed when saved or cancelled, in a dialog and as a
// page; the update form of an item, sent and closed when saved or cancelled; the action of the header shown once the backend allows it; the deletion of the item of
// a card, shown when the user may delete it, followed by the route `then`, a refusal kept on
// the card; a custom action of the route set of the contract, on a card, a row, the selected
// rows and the toolbar of a list (one of an item and one of the route set of the same name
// told apart), shown as the backend allows it, its fields in a dialog, once per item at a time,
// a refusal in its dialog or in a toast; the form of a custom action of the route set as a
// page, its fields read from the contract (a relationship a picker, a decimal on one line,
// their labels, the ids of the uploaded files their file fields, waited for while they
// upload), its errors, its result from the answer of the action, or done without one;
// the key of a custom action in the contract (`customActionKey`), which the link of its form
// requires; and the props of an extension joined with the generated ones. Keep it passing when the
// component is changed.

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Filter } from '@/bazis/client';
import type * as Contract from '@/bazis/generated/contract';

import { AppShell, Screen } from '@/bazis/ui/app-shell';
import { customActionKey, FilesProvider, type FileControlProps, type FilesControlProps } from '@/bazis/ui/resource';
import { ResourceCard, type ResourceCardProps } from '@/bazis/ui/resource-card';
import { ResourceList } from '@/bazis/ui/resource-list';
import {
  ActionForm,
  CreateFormAction,
  extended,
  ScreenAction,
  useCustomAction,
  useDestroyCardAction,
  UpdateFormAction,
  type ActionFormProps,
  type CreateFormActionProps,
  type CustomActionOptions,
  type ScreenExtension,
} from '@/bazis/ui/screens';
import { toast } from '@/bazis/ui/state-panel';
import { Backend, errors, ITEM_ID, ITEMS, listDocument, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

// the contract of the product with the resource of the tests, its fields (an owner and the
// watchers, relationships to the route set of the owners, `test.owner`, any product has none)
// and its custom actions: of an item,
// which requires its change, its body a priority with a default and a decimal price; of the
// route set, without a body; `mark-done` of the route set, whose key is that of its method;
// `export` of the route set and of an item alike, without a body;
// `suggest` of the route set, its body a title, the owner and the watchers (their ids), the
// hours (a decimal), a note, and the ids of uploaded files (`x-relation` of `UploadedFileId`
// of bazis-uploadable: a scan and photos, of the files of the tests, `test.file`) and of a
// reviewer (of the owners), and whether it is urgent (a required boolean); `escalate` also
// takes the id of a file, its evidence; `report` answers a file, its body a year, a date and a
// date-time
vi.mock('@/bazis/generated/contract', async (importOriginal) => {
  const contract = await importOriginal<typeof Contract>();
  const priority = { enum: ['low', 'high'], title: 'Priority', type: 'string' };
  return {
    ...contract,
    ROUTES: { ...contract.ROUTES, 'test.owner': '/api/test/owner/' },
    RESOURCES: {
      ...contract.RESOURCES,
      'test.item': {
        path: '/api/test/item/',
        fields: {
          owner: { relation: 'test.owner', many: false, title: 'Owner' },
          watchers: { relation: 'test.owner', many: true, title: 'Watchers' },
        },
        search: [],
        custom_actions: {
          action_escalate: {
            name: 'escalate',
            item: true,
            method: 'post',
            access_action: 'change',
            body: {
              type: 'object',
              properties: {
                priority: { $ref: '#/$defs/Priority', default: 'high' },
                // `Decimal` of Pydantic: a number or a string
                price: { anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'string' }, { type: 'null' }], default: null, title: 'Price' },
                evidence: { type: 'string', 'x-relation': 'test.file', title: 'Evidence' },
              },
              $defs: { Priority: priority },
            },
          },
          action_count: { name: 'count', item: false, method: 'post', access_action: null, body: null },
          // `@http_post('/mark-done/')` of the method `action_mark_done`: its key is named by the method
          action_mark_done: { name: 'mark-done', item: false, method: 'post', access_action: null, body: null },
          action_export: { name: 'export', item: false, method: 'post', access_action: null, body: null },
          action_export_item: { name: 'export', item: true, method: 'post', access_action: null, body: null },
          // a `response_class` of CSV: it answers a file
          action_report: {
            name: 'report',
            item: false,
            method: 'post',
            access_action: null,
            body: {
              type: 'object',
              properties: {
                year: { type: 'integer', title: 'Year' },
                from: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }], default: null, title: 'From' },
                until: { type: 'string', format: 'date-time', title: 'Until' },
              },
            },
            file: true,
          },
          action_suggest: {
            name: 'suggest',
            item: false,
            method: 'post',
            access_action: null,
            body: {
              type: 'object',
              properties: {
                title: { type: 'string', title: 'Title' },
                owner: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }], default: null, title: 'Owner id' },
                watchers: { type: 'array', items: { type: 'string', format: 'uuid' }, title: 'Watcher ids' },
                hours: { anyOf: [{ type: 'number' }, { type: 'string' }], title: 'Hours' },
                note: { type: 'string', title: 'Note' },
                scan: { anyOf: [{ type: 'string', 'x-relation': 'test.file' }, { type: 'null' }], default: null, title: 'Scan' },
                photos: { type: 'array', items: { type: 'string', 'x-relation': 'test.file' }, maxItems: 3, default: [], title: 'Photos' },
                reviewer: { type: 'string', 'x-relation': 'test.owner', title: 'Reviewer' },
                urgent: { type: 'boolean', title: 'Urgent' },
              },
              required: ['title', 'urgent'],
            },
          },
        },
      },
    },
  };
});

// the toasts of the deletion and of the custom actions, whatever their texts
vi.mock('@/bazis/ui/state-panel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/bazis/ui/state-panel')>()),
  toast: vi.fn(),
}));

// the popover of a picker is positioned with ResizeObserver and scrolls its active option into
// view, which jsdom does not have
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

const ITEM = `${ITEMS}${ITEM_ID}/`;

const createSchema = runtimeSchema({
  title: { attribute: { type: 'string', maxLength: 100, title: 'Title' }, required: true },
  day: { attribute: { type: 'string', format: 'date', title: 'Day' } },
});

/** A screen with a create form: a button opens it, another starting with a day. */
function Creating({ onSaved, mode }: Pick<CreateFormActionProps, 'onSaved' | 'mode'>) {
  const create = CreateFormAction.use();
  return (
    <Screen id="item-list" title="Items">
      <button type="button" data-bz="action:create" onClick={create.onOpen}>
        New
      </button>
      <button
        type="button"
        data-bz="action:add-day"
        onClick={() => {
          create.onOpenWith({ day: '2026-10-18' });
        }}
      >
        New on a day
      </button>
      <CreateFormAction {...create} path={ITEMS as never} fields={['title', 'day']} title="New item" onSaved={onSaved} mode={mode} />
    </Screen>
  );
}

function created(title: string) {
  return { data: resource(ITEM_ID, { title }) };
}

describe('CreateFormAction', () => {
  for (const mode of ['dialog', 'page'] as const) {
    it(`creates an item in a ${mode} and closes it`, async () => {
      const onSaved = vi.fn();
      const backend = new Backend()
        .on('GET', `${ITEMS}schema_create/`, createSchema)
        .on('POST', ITEMS, created('Report'), 201);
      renderWithBazis(<Creating onSaved={onSaved} mode={mode} />, backend);
      expect(screen.queryByTestId('action:submit')).toBeNull();

      // the click of a button opens it: its event is no value of a field
      fireEvent.click(screen.getByTestId('action:create'));
      fireEvent.change(await screen.findByTestId('field:title'), { target: { value: 'Report' } });
      fireEvent.click(screen.getByTestId('action:submit'));
      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledWith({ data: expect.objectContaining({ id: ITEM_ID }) as unknown });
      });
      expect(screen.queryByTestId('action:submit')).toBeNull();
      expect(backend.calls.find((call) => call.method === 'POST')?.body).toEqual({
        data: { type: 'test.item', attributes: { title: 'Report' }, relationships: {} },
      });
    });
  }

  it('starts with the values it is opened with, which the user changes, and forgets them when opened again', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_create/`, createSchema)
      .on('POST', ITEMS, created('Visit'), 201);
    renderWithBazis(<Creating mode="dialog" />, backend);

    fireEvent.click(screen.getByTestId('action:add-day'));
    fireEvent.change(await screen.findByTestId('field:title'), { target: { value: 'Visit' } });
    const day = screen.getByTestId<HTMLInputElement>('field:day');
    expect(day.value).toBe('2026-10-18');
    expect(day.readOnly).toBe(false);
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(screen.queryByTestId('action:submit')).toBeNull();
    });
    // sent as it is, a change that the user did not make
    expect(backend.calls.find((call) => call.method === 'POST')?.body).toEqual({
      data: { type: 'test.item', attributes: { title: 'Visit', day: '2026-10-18' }, relationships: {} },
    });

    fireEvent.click(screen.getByTestId('action:add-day'));
    fireEvent.change(await screen.findByTestId('field:title'), { target: { value: 'Later' } });
    fireEvent.change(screen.getByTestId('field:day'), { target: { value: '2026-10-19' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(backend.calls.filter((call) => call.method === 'POST')).toHaveLength(2);
    });
    expect(backend.calls.filter((call) => call.method === 'POST')[1]?.body).toEqual({
      data: { type: 'test.item', attributes: { title: 'Later', day: '2026-10-19' }, relationships: {} },
    });

    fireEvent.click(screen.getByTestId('action:create'));
    fireEvent.change(await screen.findByTestId('field:title'), { target: { value: 'Other' } });
    expect(screen.getByTestId<HTMLInputElement>('field:day').value).toBe('');
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(backend.calls.filter((call) => call.method === 'POST')).toHaveLength(3);
    });
    expect(backend.calls.filter((call) => call.method === 'POST')[2]?.body).toEqual({
      data: { type: 'test.item', attributes: { title: 'Other' }, relationships: {} },
    });
  });

  it('closes without saving when cancelled', async () => {
    const onSaved = vi.fn();
    renderWithBazis(<Creating onSaved={onSaved} mode="dialog" />, new Backend().on('GET', `${ITEMS}schema_create/`, createSchema));
    fireEvent.click(screen.getByTestId('action:create'));
    fireEvent.click(await screen.findByTestId('action:cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('action:submit')).toBeNull();
    });
    expect(onSaved).not.toHaveBeenCalled();
  });
});

/** A screen with the update form of the item: a button opens it. */
function Updating({ onSaved }: Pick<CreateFormActionProps, 'onSaved'>) {
  const edit = UpdateFormAction.use();
  return (
    <Screen id="item-card" title="Item">
      <button type="button" data-bz="action:edit" onClick={edit.onOpen}>
        Edit
      </button>
      <UpdateFormAction {...edit} path={ITEMS as never} id={ITEM_ID} fields={['title']} title="Edit the item" onSaved={onSaved} mode="dialog" />
    </Screen>
  );
}

describe('UpdateFormAction', () => {
  function updateBackend() {
    return new Backend()
      .on('GET', `${ITEM}schema_update/`, createSchema)
      .on('GET', ITEM, { data: resource(ITEM_ID, { title: 'Report' }) })
      .on('PATCH', ITEM, created('Final report'));
  }

  it('updates the item and closes', async () => {
    const onSaved = vi.fn();
    const backend = updateBackend();
    renderWithBazis(<Updating onSaved={onSaved} />, backend);
    expect(screen.queryByTestId('action:submit')).toBeNull();

    fireEvent.click(screen.getByTestId('action:edit'));
    const title = await screen.findByTestId<HTMLInputElement>('field:title');
    expect(title.value).toBe('Report');
    fireEvent.change(title, { target: { value: 'Final report' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({ data: expect.objectContaining({ id: ITEM_ID }) as unknown });
    });
    expect(screen.queryByTestId('action:submit')).toBeNull();
    expect(backend.calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({
      data: { id: ITEM_ID, type: 'test.item', attributes: { title: 'Final report' } },
    });
  });

  it('closes without saving when cancelled', async () => {
    const onSaved = vi.fn();
    const backend = updateBackend();
    renderWithBazis(<Updating onSaved={onSaved} />, backend);
    fireEvent.click(screen.getByTestId('action:edit'));
    fireEvent.click(await screen.findByTestId('action:cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('action:submit')).toBeNull();
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(backend.requests('PATCH')).toEqual([]);
  });
});

describe('ScreenAction', () => {
  it('is shown once the backend allows what it requires', async () => {
    const onClick = vi.fn();
    const action = <ScreenAction id="create" label="New" requires={{ path: ITEMS, can: 'add' }} onClick={onClick} />;
    const CREATE = `${ITEMS}?page%5Blimit%5D=1&meta=for_create`;
    const allowed = renderWithBazis(action, new Backend().on('GET', CREATE, { data: [], meta: { for_create: true } }));
    fireEvent.click(await screen.findByTestId('action:create'));
    expect(onClick).toHaveBeenCalledWith();
    allowed.unmount();

    // no runtime schema of the create asked for (and refused) once the list tells it
    const backend = new Backend().on('GET', CREATE, { data: [], meta: { for_create: false } });
    renderWithBazis(action, backend);
    await waitFor(() => {
      expect(backend.requests('GET')).toEqual([`GET ${CREATE}`]);
    });
    expect(screen.queryByTestId('action:create')).toBeNull();
  });

  it('is shown at once without a requirement', () => {
    renderWithBazis(<ScreenAction id="export" label="Export" onClick={vi.fn()} />, new Backend());
    expect(screen.getByTestId('action:export')).toBeTruthy();
  });
});

const cardSchema = runtimeSchema({ title: { attribute: { type: 'string', title: 'Title' } } });

function cardBackend(meta: unknown) {
  return new Backend()
    .on('GET', `${ITEM}schema_retrieve/`, cardSchema)
    .on('GET', ITEM, { data: resource(ITEM_ID, { title: 'Report' }), meta });
}

/** The card of the item with its deletion, which leads to `/items`. */
function DestroyingCard() {
  const destroy = useDestroyCardAction({ id: 'delete', label: 'Delete', path: ITEMS as never, item: ITEM_ID, then: '/items' });
  return (
    <>
      <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={[{ id: 'main', fields: ['title'] }]} actions={[destroy.action]} />
      {destroy.confirm}
    </>
  );
}

function renderCard(backend: Backend) {
  vi.mocked(toast).mockClear();
  return renderWithBazis(
    <Routes>
      <Route path="/items/:id" element={<DestroyingCard />} />
      <Route path="/items" element={<p data-bz="screen:item-list" />} />
    </Routes>,
    backend,
    { route: `/items/${ITEM_ID}` },
  );
}

describe('useDestroyCardAction', () => {
  it('deletes the item of the card once confirmed, then shows the route `then`', async () => {
    const backend = cardBackend({ crud_actions: ['view', 'delete'] }).on('DELETE', ITEM, undefined, 204);
    renderCard(backend);
    fireEvent.click(await screen.findByTestId('action:delete'));
    expect(backend.requests('DELETE')).toEqual([]);
    // the title of the confirmation is a question, not the label of its button
    expect(screen.getByRole('heading', { name: 'Delete this item?' })).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain('It is deleted for good');
    const read = backend.requests('GET').length;
    fireEvent.click(screen.getByTestId('action:confirm-delete'));
    expect(await screen.findByTestId('screen:item-list')).toBeTruthy();
    expect(backend.requests('DELETE')).toEqual([`DELETE ${ITEM}`]);
    expect(toast).toHaveBeenCalledWith({ title: expect.any(String) as unknown });
    // the deleted item is not read again on the way to the route
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(backend.requests('GET').slice(read)).toEqual([]);
  });

  it('sends one deletion whatever the clicks of its confirmation', async () => {
    const backend = cardBackend({ crud_actions: ['view', 'delete'] }).on('DELETE', ITEM, undefined, 204);
    renderCard(backend);
    fireEvent.click(await screen.findByTestId('action:delete'));
    const confirm = screen.getByTestId('action:confirm-delete');
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(await screen.findByTestId('screen:item-list')).toBeTruthy();
    expect(backend.requests('DELETE')).toEqual([`DELETE ${ITEM}`]);
  });

  it('shows the item deleted as not found when the screen stays on it, without reading it again', async () => {
    // a card that is not left (no `then`), as one next to the list of a bulk deletion
    function Staying() {
      const destroy = useDestroyCardAction({ id: 'delete', label: 'Delete', path: ITEMS as never, item: ITEM_ID });
      return (
        <>
          <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={[{ id: 'main', fields: ['title'] }]} actions={[destroy.action]} />
          {destroy.confirm}
        </>
      );
    }
    const backend = cardBackend({ crud_actions: ['view', 'delete'] }).on('DELETE', ITEM, undefined, 204);
    renderWithBazis(<Staying />, backend);
    fireEvent.click(await screen.findByTestId('action:delete'));
    const read = backend.requests('GET').length;
    fireEvent.click(screen.getByTestId('action:confirm-delete'));
    expect(await screen.findByTestId('state:not_found')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(backend.requests('GET').slice(read)).toEqual([]);
  });

  it('says what the action describes and keeps the item when cancelled', async () => {
    function Described() {
      const destroy = useDestroyCardAction({
        id: 'delete',
        label: 'Delete',
        title: 'Delete the task?',
        description: 'The steps of the task go with it.',
        path: ITEMS as never,
        item: ITEM_ID,
      });
      return (
        <>
          <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={[{ id: 'main', fields: ['title'] }]} actions={[destroy.action]} />
          {destroy.confirm}
        </>
      );
    }
    const backend = cardBackend({ crud_actions: ['view', 'delete'] });
    renderWithBazis(<Described />, backend);
    fireEvent.click(await screen.findByTestId('action:delete'));
    expect(screen.getByRole('heading', { name: 'Delete the task?' })).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain('The steps of the task go with it.');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(backend.requests('DELETE')).toEqual([]);
  });

  it('is not shown when the user may not delete the item', async () => {
    renderCard(cardBackend({ crud_actions: ['view'] }));
    expect(await screen.findByTestId('state:loaded')).toBeTruthy();
    expect(screen.queryByTestId('action:delete')).toBeNull();
  });

  it('keeps the card and says why when the backend refuses', async () => {
    const backend = cardBackend({ crud_actions: ['view', 'delete'] }).on('DELETE', ITEM, errors(409), 409);
    renderCard(backend);
    fireEvent.click(await screen.findByTestId('action:delete'));
    fireEvent.click(screen.getByTestId('action:confirm-delete'));
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({ title: expect.any(String) as unknown, description: 'HTTP 409', tone: 'danger' });
    });
    expect(screen.queryByTestId('screen:item-list')).toBeNull();
    expect(screen.getByTestId('action:delete')).toBeTruthy();
  });
});

/** The list schema of the items: the priority, with the labels of its choices in the language of the interface. */
const listSchema = runtimeSchema(
  {
    title: { attribute: { type: 'string', title: 'Title' } },
    priority: { attribute: { type: 'string', enum: ['low', 'high'], enumDict: { low: 'Basse', high: 'Haute' }, title: 'Priorité' } },
  },
  { list: true },
);

const ESCALATE: CustomActionOptions = { id: 'escalate', label: 'Escalate', path: ITEMS, action: 'escalate', target: 'item' };

/** The card of the item with the custom action `escalate`. */
function EscalatingCard(options: Partial<CustomActionOptions>) {
  const escalate = useCustomAction({ ...ESCALATE, item: ITEM_ID, ...options });
  return (
    <>
      <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={[{ id: 'main', fields: ['title'] }]} actions={[escalate.action]} />
      {escalate.dialog}
    </>
  );
}

/** A list with the custom actions of the route set (`count`) in its toolbar, and `escalate` on its rows and on the selected ones. */
function EscalatingList() {
  const count = useCustomAction({ id: 'count', label: 'Count', path: ITEMS, action: 'count', target: 'route' });
  const escalate = useCustomAction({ ...ESCALATE, confirm: true });
  const escalateAll = useCustomAction({ ...ESCALATE, id: 'escalate-all' });
  return (
    <>
      <ResourceList
        path={ITEMS as never}
        entity="item"
        columns={['title']}
        layout="table"
        actions={[count.action]}
        rowActions={[escalate.row]}
        bulk={[escalateAll.bulk]}
      />
      {count.dialog}
      {escalate.dialog}
    </>
  );
}

/** A list with `export` of the route set in its toolbar and `export` of an item on its rows, both at once. */
function ExportingList() {
  const exportAll = useCustomAction({ id: 'export-all', label: 'Export', path: ITEMS, action: 'export', target: 'route' });
  const exportRow = useCustomAction({ id: 'export', label: 'Export', path: ITEMS, action: 'export', target: 'item' });
  return <ResourceList path={ITEMS as never} entity="item" columns={['title']} layout="table" actions={[exportAll.action]} rowActions={[exportRow.row]} />;
}

function exportingBackend(listed: readonly string[]) {
  return new Backend()
    .on('GET', `${ITEMS}schema_list/`, listSchema)
    .on('GET', ITEMS, listDocument([resource('a', { title: 'First' }), resource('b', { title: 'Second' })], {
      meta: { for_change: [], custom_actions: listed },
    }));
}

describe('useCustomAction', () => {
  it('runs the action of the item of a card, its fields in a dialog, when the backend lists it', async () => {
    vi.mocked(toast).mockClear();
    const backend = cardBackend({ crud_actions: ['view'], custom_actions: ['action_escalate'] })
      .on('GET', `${ITEMS}schema_list/`, listSchema)
      .on('POST', `${ITEM}escalate/`, { priority: 'low' });
    renderWithBazis(<EscalatingCard fields={['priority']} message="Escalated" />, backend);
    fireEvent.click(await screen.findByTestId('action:escalate'));
    // the field of the body named as a field of the resource: its title and its choices from the list schema
    const field = await screen.findByTestId('field:priority');
    await waitFor(() => {
      expect(screen.getByRole('dialog').textContent).toContain('Priorité');
    });
    // the default of the body
    expect((field as HTMLSelectElement | HTMLButtonElement).textContent).toContain('Haute');
    const itemReads = () => backend.requests('GET').filter((it) => it.startsWith(`GET ${ITEM}?`)).length;
    const read = itemReads();
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(screen.queryByTestId('action:submit')).toBeNull();
    });
    expect(backend.calls.filter((it) => it.method === 'POST').map((it) => [it.url, it.body])).toEqual([
      [`${ITEM}escalate/`, { priority: 'high' }],
    ]);
    expect(toast).toHaveBeenCalledWith({ title: 'Escalate', description: 'Escalated' });
    // the card is read again
    await waitFor(() => {
      expect(itemReads()).toBeGreaterThan(read);
    });
  });

  it('opens its dialog with the values of the specs over the defaults of the body', async () => {
    const backend = cardBackend({ crud_actions: ['view'], custom_actions: ['action_escalate'] })
      .on('GET', `${ITEMS}schema_list/`, listSchema)
      .on('POST', `${ITEM}escalate/`, { priority: 'low' });
    renderWithBazis(<EscalatingCard fields={['priority', 'price']} values={{ priority: 'low', price: '2.5' }} />, backend);
    fireEvent.click(await screen.findByTestId('action:escalate'));
    expect(screen.getByTestId<HTMLInputElement>('field:price').value).toBe('2.5');
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(backend.calls.filter((it) => it.method === 'POST').map((it) => it.body)).toEqual([{ priority: 'low', price: '2.5' }]);
    });
  });

  it('waits in its dialog for the file of a field to upload', async () => {
    const backend = cardBackend({ crud_actions: ['view'], custom_actions: ['action_escalate'] })
      .on('GET', `${ITEMS}schema_list/`, listSchema)
      .on('POST', `${ITEM}escalate/`, { priority: 'high' });
    const files = fileControls();
    renderWithBazis(files.wrap(<EscalatingCard fields={['evidence']} />), backend);
    fireEvent.click(await screen.findByTestId('action:escalate'));
    fireEvent.click(await screen.findByTestId('field:evidence'));
    expect(screen.getByTestId<HTMLButtonElement>('action:submit').disabled).toBe(true);
    fireEvent.submit(within(screen.getByRole('dialog')).getByTestId('action:submit').closest('form') as HTMLFormElement);
    expect(backend.requests('POST')).toEqual([]);
    files.finish();
    expect(screen.getByTestId<HTMLButtonElement>('action:submit').disabled).toBe(false);
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(backend.requests('POST')).toEqual([`POST ${ITEM}escalate/`]);
    });
    expect(backend.calls.find((it) => it.method === 'POST')?.body).toEqual({ evidence: '1' });
  });

  it('labels its fields with the labels of the specs first, and asks for a relationship of the body with its picker', async () => {
    const backend = new Backend().on('GET', `${ITEMS}schema_list/`, listSchema);
    function Suggest() {
      const suggest = useCustomAction({
        id: 'suggest',
        label: 'Suggest',
        path: ITEMS,
        action: 'suggest',
        target: 'route',
        fields: ['priority', 'title', 'owner'],
        labels: { title: 'What to do' },
        filters: { owner: Filter.where('is_active', true) },
      });
      return (
        <>
          <button type="button" data-bz="action:suggest" onClick={suggest.action.onClick} />
          {suggest.dialog}
        </>
      );
    }
    renderWithBazis(<Suggest />, backend);
    fireEvent.click(screen.getByTestId('action:suggest'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('What to do');
    expect(screen.getByTestId('field:owner').tagName).toBe('BUTTON');
    // a property that the body does not have is not asked for
    expect(screen.queryByTestId('field:priority')).toBeNull();
    // its picker offers the items of its filter
    fireEvent.click(screen.getByTestId('field:owner'));
    await screen.findByRole('listbox');
    await waitFor(() => {
      expect(backend.requests('GET')).toContain('GET /api/test/owner/?filter=is_active%3Dtrue&page%5Blimit%5D=20');
    });
  });

  it('keeps its dialog open with the errors of its fields', async () => {
    const backend = cardBackend({ crud_actions: ['view'], custom_actions: ['action_escalate'] })
      .on('GET', `${ITEMS}schema_list/`, listSchema)
      .on('POST', `${ITEM}escalate/`, { errors: [{ status: 422, detail: 'Not a choice', source: { pointer: '/priority' } }] }, 422);
    renderWithBazis(<EscalatingCard fields={['priority']} />, backend);
    fireEvent.click(await screen.findByTestId('action:escalate'));
    fireEvent.click(await screen.findByTestId('action:submit'));
    expect((await screen.findByTestId('error:priority')).textContent).toContain('Not a choice');
    expect(screen.getByTestId('action:submit')).toBeTruthy();
  });

  it('asks for a decimal of the body on one line and sends its digits with a point', async () => {
    const backend = cardBackend({ crud_actions: ['view'], custom_actions: ['action_escalate'] })
      .on('GET', `${ITEMS}schema_list/`, listSchema)
      .on('POST', `${ITEM}escalate/`, {});
    renderWithBazis(<EscalatingCard fields={['priority', 'price']} />, backend);
    fireEvent.click(await screen.findByTestId('action:escalate'));
    const price = await screen.findByTestId<HTMLInputElement>('field:price');
    expect([price.tagName, price.inputMode]).toEqual(['INPUT', 'decimal']);
    fireEvent.change(price, { target: { value: '2,5' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(backend.calls.filter((it) => it.method === 'POST').map((it) => it.body)).toEqual([{ priority: 'high', price: '2.5' }]);
    });
  });

  it('is not shown on a card when the backend does not list it', async () => {
    renderWithBazis(<EscalatingCard />, cardBackend({ crud_actions: ['view', 'change'], custom_actions: [] }));
    await screen.findByTestId('state:loaded');
    expect(screen.queryByTestId('action:escalate')).toBeNull();
  });

  it('runs the action of a row once confirmed, on the rows that the user may change', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_list/`, listSchema)
      .on('GET', ITEMS, listDocument([resource('a', { title: 'First' }), resource('b', { title: 'Second' })], {
        meta: { for_change: ['a'], custom_actions: [] },
      }))
      .on('POST', `${ITEMS}a/escalate/`, { priority: 'high' });
    renderWithBazis(<EscalatingList />, backend);
    await screen.findByTestId('state:loaded');
    const rows = screen.getAllByTestId('action:escalate');
    // the second row is not one the user may change
    expect(rows).toHaveLength(1);
    fireEvent.click(rows[0] as HTMLElement);
    expect(backend.requests('POST')).toEqual([]);
    fireEvent.click(screen.getByTestId('action:confirm-escalate'));
    await waitFor(() => {
      expect(backend.requests('POST')).toEqual([`POST ${ITEMS}a/escalate/`]);
    });
    expect(backend.calls.find((it) => it.method === 'POST')?.body).toEqual({});
  });

  it('runs on the selected rows, and the action of the route set from the toolbar, once the backend lists it', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_list/`, listSchema)
      .on('GET', ITEMS, listDocument([resource('a', { title: 'First' }), resource('b', { title: 'Second' })], {
        meta: { for_change: ['a', 'b'], custom_actions: ['action_count'] },
      }))
      .on('POST', `${ITEMS}a/escalate/`, { priority: 'high' })
      .on('POST', `${ITEMS}b/escalate/`, { priority: 'high' })
      .on('POST', `${ITEMS}count/`, { task: 't' });
    renderWithBazis(<EscalatingList />, backend);
    await screen.findByTestId('state:loaded');
    // the list asks for the custom actions of the route set
    expect(backend.requests('GET').some((it) => decodeURIComponent(it).includes('custom_actions'))).toBe(true);
    fireEvent.click(screen.getByTestId('select:all'));
    fireEvent.click(screen.getByTestId('bulk:escalate-all'));
    fireEvent.click(screen.getByTestId('action:confirm-bulk'));
    await waitFor(() => {
      expect(backend.requests('POST')).toEqual([`POST ${ITEMS}a/escalate/`, `POST ${ITEMS}b/escalate/`]);
    });
    // without fields nor a confirmation, at once
    fireEvent.click(screen.getByTestId('action:count'));
    await waitFor(() => {
      expect(backend.requests('POST')).toContain(`POST ${ITEMS}count/`);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('runs the action of the route set from the toolbar and that of an item of the same name on the rows', async () => {
    const backend = exportingBackend(['action_export']).on('POST', `${ITEMS}export/`, {}).on('POST', `${ITEMS}a/export/`, {});
    renderWithBazis(<ExportingList />, backend);
    await screen.findByTestId('state:loaded');
    // the toolbar by `action_export` of the meta, the rows by their access (none required)
    fireEvent.click(screen.getByTestId('action:export-all'));
    fireEvent.click(screen.getAllByTestId('action:export')[0] as HTMLElement);
    await waitFor(() => {
      expect(backend.requests('POST')).toEqual([`POST ${ITEMS}export/`, `POST ${ITEMS}a/export/`]);
    });
  });

  it('runs on two rows at once, and once on a row clicked again before its answer', async () => {
    const backend = exportingBackend([]).on('POST', `${ITEMS}a/export/`, {}).on('POST', `${ITEMS}b/export/`, {});
    renderWithBazis(<ExportingList />, backend);
    await screen.findByTestId('state:loaded');
    const [first, second] = screen.getAllByTestId('action:export') as [HTMLElement, HTMLElement];
    fireEvent.click(first);
    fireEvent.click(second);
    fireEvent.click(first);
    await waitFor(() => {
      expect(backend.requests('POST')).toHaveLength(2);
    });
    expect(backend.requests('POST').sort()).toEqual([`POST ${ITEMS}a/export/`, `POST ${ITEMS}b/export/`]);
  });

  it('tells a refusal without a dialog in a toast', async () => {
    vi.mocked(toast).mockClear();
    const backend = exportingBackend([]).on('POST', `${ITEMS}a/export/`, errors(403), 403);
    renderWithBazis(<ExportingList />, backend);
    await screen.findByTestId('state:loaded');
    fireEvent.click(screen.getAllByTestId('action:export')[0] as HTMLElement);
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({ title: 'Export', description: 'HTTP 403', tone: 'danger' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps its dialog open and says that the user may not, refused', async () => {
    vi.mocked(toast).mockClear();
    const backend = cardBackend({ crud_actions: ['view'], custom_actions: ['action_escalate'] })
      .on('GET', `${ITEMS}schema_list/`, listSchema)
      .on('POST', `${ITEM}escalate/`, errors(403), 403);
    renderWithBazis(<EscalatingCard fields={['priority']} />, backend);
    fireEvent.click(await screen.findByTestId('action:escalate'));
    fireEvent.click(await screen.findByTestId('action:submit'));
    expect(within(await screen.findByRole('dialog')).getByTestId('state:forbidden')).toBeTruthy();
    expect(screen.getByTestId('action:submit')).toBeTruthy();
    expect(toast).not.toHaveBeenCalled();
  });

  it('is not in the toolbar when the backend does not list it', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_list/`, listSchema)
      .on('GET', ITEMS, listDocument([resource('a', { title: 'First' })], { meta: { for_change: [], custom_actions: [] } }));
    renderWithBazis(<EscalatingList />, backend);
    await screen.findByTestId('state:loaded');
    expect(screen.queryByTestId('action:count')).toBeNull();
    expect(screen.queryByTestId('action:escalate')).toBeNull();
  });
});

const SUGGESTED = `${ITEMS}suggest/`;

function Suggesting(props: Partial<ActionFormProps>) {
  return <ActionForm path={ITEMS} action="suggest" fields={['title', 'owner', 'watchers', 'hours', 'note']} {...props} />;
}

/**
 * The controls of the file fields of the tests, buttons that upload a file (of a field of one
 * file, of a field of several) until `finish` is called.
 */
function fileControls() {
  const uploads: (() => void)[] = [];
  function One({ control, onChange, onBusy }: FileControlProps) {
    return (
      <button
        type="button"
        id={control.id}
        data-bz={control['data-bz']}
        onClick={() => {
          onBusy(true);
          uploads.push(() => {
            onChange('1');
            onBusy(false);
          });
        }}
      >
        one file
      </button>
    );
  }
  function Many({ field, control, value, onChange, onBusy }: FilesControlProps) {
    return (
      <button
        type="button"
        id={control.id}
        data-bz={control['data-bz']}
        data-max-items={field.maxItems}
        onClick={() => {
          onBusy(true);
          uploads.push(() => {
            onChange([...value, `token-${String(value.length + 1)}`]);
            onBusy(false);
          });
        }}
      >
        several files
      </button>
    );
  }
  return {
    wrap: (children: ReactNode) => (
      <FilesProvider control={One} listControl={Many} resources={['test.file']}>
        {children}
      </FilesProvider>
    ),
    finish: () => {
      act(() => {
        uploads.shift()?.();
      });
    },
  };
}

describe('ActionForm', () => {
  it('offers the items of its filters in the pickers of its relationships', async () => {
    const backend = new Backend().on('GET', '/api/test/owner/', listDocument([resource('a1', { name: 'Ann' }, {}, 'test.owner')]));
    renderWithBazis(<Suggesting filters={{ watchers: Filter.where('is_staff', false) }} />, backend);
    fireEvent.click(await screen.findByTestId('field:watchers'));
    await within(await screen.findByRole('listbox')).findByText('Ann');
    expect(backend.requests('GET')).toEqual(['GET /api/test/owner/?filter=is_staff%3Dfalse&page%5Blimit%5D=20']);
  });

  it('asks for the ids of the uploaded files with the file fields, waits for their uploads and sends them once', async () => {
    const backend = new Backend().on('POST', SUGGESTED, { task: 't-1' });
    const files = fileControls();
    renderWithBazis(
      files.wrap(<Suggesting fields={['title', 'scan', 'photos', 'reviewer']} result={{ message: () => 'Done' }} />),
      backend,
    );
    // `x-relation` of the files: their controls; of another resource: the picker of its items
    expect(screen.getByTestId('field:scan').textContent).toBe('one file');
    expect(screen.getByTestId('field:photos').textContent).toBe('several files');
    // at most the `maxItems` of the property
    expect(screen.getByTestId('field:photos').dataset.maxItems).toBe('3');
    expect(screen.getByTestId('field:reviewer').textContent).not.toContain('file');
    expect(screen.getByTestId('field:reviewer').getAttribute('aria-haspopup')).toBeTruthy();
    expect(screen.getByLabelText('Photos')).toBe(screen.getByTestId('field:photos'));

    fireEvent.change(screen.getByTestId('field:title'), { target: { value: 'Fix the tap' } });
    fireEvent.click(screen.getByTestId('field:scan'));
    files.finish();
    fireEvent.click(screen.getByTestId('field:photos'));
    // a file uploads: the form is not sent
    const submit = screen.getByTestId<HTMLButtonElement>('action:submit');
    expect(submit.disabled).toBe(true);
    fireEvent.submit(screen.getByTestId('state:loaded'));
    expect(backend.requests('POST')).toEqual([]);
    files.finish();
    fireEvent.click(screen.getByTestId('field:photos'));
    files.finish();
    expect(submit.disabled).toBe(false);
    // sent once, however often it is submitted meanwhile
    fireEvent.click(submit);
    fireEvent.submit(screen.getByTestId('state:loaded'));
    await screen.findByTestId('state:done');
    expect(backend.calls.map((it) => [it.method, it.url, it.body])).toEqual([
      ['POST', SUGGESTED, { title: 'Fix the tap', scan: '1', photos: ['token-1', 'token-2'] }],
    ]);
  });

  it('sends a required boolean of the body left unchecked as false, its checkbox not required', async () => {
    const backend = new Backend().on('POST', SUGGESTED, { task: 't-1' });
    renderWithBazis(<Suggesting fields={['title', 'urgent']} result={{ message: () => 'Done' }} />, backend);
    const urgent = screen.getByTestId<HTMLInputElement>('field:urgent');
    expect([urgent.type, urgent.checked, urgent.required, urgent.labels?.[0]?.textContent]).toEqual(['checkbox', false, false, 'Urgent']);
    fireEvent.change(screen.getByTestId('field:title'), { target: { value: 'Fix the tap' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await screen.findByTestId('state:done');
    expect(backend.calls.map((it) => it.body)).toEqual([{ title: 'Fix the tap', urgent: false }]);
  });

  it('asks for the properties of the body from the contract, without a runtime schema, and shows the result', async () => {
    const backend = new Backend().on('POST', SUGGESTED, { task: 't-1', count: 3, done: true });
    renderWithBazis(
      <Suggesting
        labels={{ note: 'Your note' }}
        result={{ title: 'Thank you', message: (response) => `Task ${String(response.task)} of ${String(response.count)}` }}
        then={{ screen: 'item-list', label: 'Items', to: '/items' }}
      />,
      backend,
    );
    const form = screen.getByTestId('state:loaded');
    // the labels of the specs, then the titles of the fields of the resource, then those of the body
    expect(form.textContent).toContain('Your note');
    expect(form.textContent).toContain('Owner');
    expect(form.textContent).not.toContain('Owner id');
    expect(form.textContent).toContain('Hours');
    // the relationships are the pickers of their related items, a decimal is typed on one line
    expect(screen.getByTestId('field:owner').tagName).toBe('BUTTON');
    expect(screen.getByTestId('field:watchers').tagName).toBe('BUTTON');
    expect(screen.getByTestId<HTMLInputElement>('field:hours').inputMode).toBe('decimal');

    fireEvent.change(screen.getByTestId('field:title'), { target: { value: 'Paint the fence' } });
    fireEvent.change(screen.getByTestId('field:hours'), { target: { value: '1,5' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    const done = await screen.findByTestId('state:done');
    expect(backend.calls.map((it) => [it.method, it.url, it.body])).toEqual([
      ['POST', SUGGESTED, { title: 'Paint the fence', owner: null, hours: '1.5' }],
    ]);
    // the texts and the numbers of the answer
    expect(done.textContent).toContain('Thank you');
    expect(done.textContent).toContain('Task t-1 of 3');
    // the answer that the tests read (`remember`): its texts and its numbers only, hidden
    const answers = [...done.querySelectorAll<HTMLElement>('[data-bz^="answer:"]')];
    expect(answers.map((it) => [it.dataset.bz, it.dataset.value, it.hidden])).toEqual([
      ['answer:task', 't-1', true],
      ['answer:count', '3', true],
    ]);
    expect(screen.getByTestId('nav:item-list').getAttribute('href')).toBe('/items');
    expect(screen.queryByTestId('action:submit')).toBeNull();

    // again: the form, empty
    fireEvent.click(screen.getByTestId('action:again'));
    expect(screen.getByTestId<HTMLInputElement>('field:title').value).toBe('');
    expect(screen.queryByTestId('state:done')).toBeNull();
    expect(backend.requests('GET')).toEqual([]);
  });

  it('shows the numbers of the answer in the title of the result too, when it is a function', async () => {
    const backend = new Backend().on('POST', SUGGESTED, { task: 't-1', count: 52 });
    renderWithBazis(
      <Suggesting
        fields={['title']}
        result={{ title: (response) => `Order No. ${String(response.count)}`, message: () => 'Accepted' }}
      />,
      backend,
    );
    fireEvent.click(screen.getByTestId('action:submit'));
    const done = await screen.findByTestId('state:done');
    expect(done.textContent).toContain('Order No. 52');
  });

  it('keeps the form with the errors of its fields and the state of a refusal', async () => {
    const backend = new Backend().on(
      'POST',
      SUGGESTED,
      { errors: [{ status: 422, detail: 'Too short', source: { pointer: '/title' } }] },
      422,
    );
    renderWithBazis(<Suggesting fields={['title']} result={{ message: () => 'Done' }} />, backend);
    fireEvent.click(screen.getByTestId('action:submit'));
    expect((await screen.findByTestId('error:title')).textContent).toContain('Too short');
    expect(screen.getByTestId('state:invalid')).toBeTruthy();
    expect(screen.getByTestId('action:submit')).toBeTruthy();
    expect(screen.queryByTestId('state:done')).toBeNull();
  });

  it('saves the file that the action answers, then shows its name in the result', async () => {
    // jsdom has no object URLs and saves no file
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:report'), revokeObjectURL: vi.fn() });
    const saved = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const backend = new Backend().file(`${ITEMS}report/`, 'year', 'attachment; filename="report-2026.csv"', 'POST');
    renderWithBazis(
      <ActionForm path={ITEMS} action="report" fields={['year']} result={{ message: (response) => `Saved ${String(response.filename)}` }} />,
      backend,
    );
    fireEvent.change(screen.getByTestId('field:year'), { target: { value: '2026' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    const done = await screen.findByTestId('state:done');
    expect(done.textContent).toContain('Saved report-2026.csv');
    expect(screen.getByTestId('answer:filename').dataset.value).toBe('report-2026.csv');
    expect(backend.calls.map((it) => [it.method, it.url, it.body])).toEqual([['POST', `${ITEMS}report/`, { year: 2026 }]]);
    expect(saved).toHaveBeenCalledOnce();
    expect((saved.mock.contexts[0] as HTMLAnchorElement).download).toBe('report-2026.csv');
    saved.mockRestore();
  });

  it('starts with the values of the specs, the days of the browser computed when it opens and again', async () => {
    // only the date is fake: the queries and the waits keep their timers
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 22, 15, 30));
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:report'), revokeObjectURL: vi.fn() });
    const saved = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const backend = new Backend().file(`${ITEMS}report/`, 'year', 'attachment; filename="report.csv"', 'POST');
    renderWithBazis(
      <ActionForm
        path={ITEMS}
        action="report"
        fields={['year', 'from', 'until']}
        values={{ year: 2026, from: 'month_start', until: 'today+10 09:30' }}
        result={{ message: () => 'Saved' }}
      />,
      backend,
    );
    // over the default of the body; a day of the month after the end of this one
    expect(screen.getByTestId<HTMLInputElement>('field:year').value).toBe('2026');
    expect(screen.getByTestId<HTMLInputElement>('field:from').value).toBe('2026-10-01');
    expect(screen.getByTestId<HTMLInputElement>('field:until').value).toBe('2026-11-01T09:30');
    // the user changes one
    fireEvent.change(screen.getByTestId('field:from'), { target: { value: '2026-10-15' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await screen.findByTestId('state:done');
    expect(backend.calls.map((it) => it.body)).toEqual([
      { year: 2026, from: '2026-10-15', until: new Date(2026, 10, 1, 9, 30).toISOString() },
    ]);
    // again, a month later: the days of then
    vi.setSystemTime(new Date(2026, 10, 30, 8, 0));
    fireEvent.click(screen.getByTestId('action:again'));
    expect(screen.getByTestId<HTMLInputElement>('field:from').value).toBe('2026-11-01');
    expect(screen.getByTestId<HTMLInputElement>('field:until').value).toBe('2026-12-10T09:30');
    saved.mockRestore();
    vi.useRealTimers();
  });

  it('starts a date with the last day of its month, a day before today, or a date as it is', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2028, 1, 10, 12, 0));
    const { unmount } = renderWithBazis(
      <ActionForm path={ITEMS} action="report" fields={['from', 'until']} values={{ from: 'month_end', until: 'today-10' }} />,
      new Backend(),
    );
    // a leap year; a date-time without a time starts the day
    expect(screen.getByTestId<HTMLInputElement>('field:from').value).toBe('2028-02-29');
    expect(screen.getByTestId<HTMLInputElement>('field:until').value).toBe('2028-01-31T00:00');
    unmount();
    renderWithBazis(<ActionForm path={ITEMS} action="report" fields={['from']} values={{ from: '2027-03-04' }} />, new Backend());
    expect(screen.getByTestId<HTMLInputElement>('field:from').value).toBe('2027-03-04');
    vi.useRealTimers();
  });

  it('without a result, says that it is done and calls onDone', async () => {
    vi.mocked(toast).mockClear();
    const onDone = vi.fn();
    const backend = new Backend().on('POST', SUGGESTED, { task: 't-1' });
    renderWithBazis(<Suggesting fields={['title']} onDone={onDone} />, backend);
    fireEvent.change(screen.getByTestId('field:title'), { target: { value: 'Paint' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('state:done')).toBeNull();
  });
});

describe('customActionKey', () => {
  it('is the key of the action in the contract, named by its method, not by its path', () => {
    expect(customActionKey(ITEMS, 'mark-done')).toBe('action_mark_done');
    expect(customActionKey(ITEMS, 'count')).toBe('action_count');
    expect(() => customActionKey(ITEMS, 'unknown')).toThrow(/export the contract again/);
  });

  it('shows the link of the form of the action once the backend lists its key', async () => {
    const links = [
      { screen: 'home', label: 'Home', to: '/', end: true },
      { screen: 'done', label: 'Done', to: '/done', requires: { path: ITEMS, can: customActionKey(ITEMS, 'mark-done') } },
      { screen: 'count', label: 'Count', to: '/count', requires: { path: ITEMS, can: customActionKey(ITEMS, 'count') } },
    ];
    const shell = (
      <AppShell title="Product" navigation="sidebar" items={links}>
        <Screen id="home">home</Screen>
      </AppShell>
    );
    const listed = new Backend().on('GET', ITEMS, listDocument([], { meta: { custom_actions: ['action_mark_done'] } }));
    const first = renderWithBazis(shell, listed);
    expect(await screen.findByTestId('nav:done')).toBeTruthy();
    first.unmount();

    // `action_` and the name in the path is no key of the meta (the same answer shows `count`)
    const other = new Backend().on('GET', ITEMS, listDocument([], { meta: { custom_actions: ['action_mark-done', 'action_count'] } }));
    renderWithBazis(shell, other);
    expect(await screen.findByTestId('nav:count')).toBeTruthy();
    expect(screen.queryByTestId('nav:done')).toBeNull();
  });
});

describe('extended', () => {
  it('adds the actions and the children of an extension, and replaces the other props', async () => {
    const generated = vi.fn();
    const added = vi.fn();
    renderWithBazis(
      <ResourceCard
        {...extended<ResourceCardProps>(
          {
            path: ITEMS as never,
            id: ITEM_ID,
            sections: [{ id: 'main', title: 'Main', fields: ['title'] }],
            actions: [{ id: 'generated', label: 'Generated', onClick: generated }],
            children: (item) => <p data-bz="generated-child">{item.id}</p>,
            after: <p data-bz="generated-after">generated</p>,
          },
          {
            actions: [{ id: 'added', label: 'Added', onClick: added }],
            children: (item, meta) => <p data-bz="added-child">{meta?.crud_actions?.join(',') ?? item.id}</p>,
            sections: [{ id: 'other', title: 'Other', fields: ['title'] }],
            after: (item) => <p data-bz="added-after">{item.id}</p>,
          },
        )}
      />,
      cardBackend({ crud_actions: ['view'] }),
    );
    expect(await screen.findByTestId('state:loaded')).toBeTruthy();
    expect(screen.getByTestId('generated-child').textContent).toBe(ITEM_ID);
    expect(screen.getByTestId('added-child').textContent).toBe('view');
    expect(screen.getByTestId('generated-after').textContent).toBe('generated');
    expect(screen.getByTestId('added-after').textContent).toBe(ITEM_ID);
    expect(screen.getByText('Other')).toBeTruthy();
    expect(screen.queryByText('Main')).toBeNull();
    fireEvent.click(screen.getByTestId('action:generated'));
    fireEvent.click(screen.getByTestId('action:added'));
    expect(generated).toHaveBeenCalled();
    expect(added).toHaveBeenCalled();
  });

  it('shows the children of both when they are contents rather than render props', () => {
    interface Props {
      children?: ReactNode | ((id: string) => ReactNode);
    }
    const node = (props: Props, id: string) =>
      typeof props.children === 'function' ? props.children(id) : props.children;
    render(<div data-bz="nodes">{node(extended<Props>({ children: 'generated' }, { children: ' added' }), ITEM_ID)}</div>);
    expect(screen.getByTestId('nodes').textContent).toBe('generated added');
    const mixed = extended<Props>({ children: 'generated' }, { children: (id) => ` ${id}` });
    render(<div data-bz="mixed">{node(mixed, ITEM_ID)}</div>);
    expect(screen.getByTestId('mixed').textContent).toBe(`generated ${ITEM_ID}`);
  });

  it('merges the lists of actions and of tiles by id and the records of the fields by field', () => {
    interface Item {
      id: string;
      label: string;
    }
    interface Props {
      actions?: readonly Item[];
      rowActions?: readonly Item[];
      bulk?: readonly Item[];
      tiles?: readonly Item[];
      cells?: Readonly<Record<string, string>>;
      values?: Readonly<Record<string, string>>;
      display?: Readonly<Record<string, string>>;
      columns: readonly string[];
      search?: boolean;
    }
    const props: Props = {
      actions: [{ id: 'create', label: 'Create' }],
      rowActions: [{ id: 'a', label: 'A' }],
      bulk: [{ id: 'b', label: 'B' }],
      tiles: [
        { id: 'drafts', label: 'Drafts' },
        { id: 'done', label: 'Done' },
      ],
      cells: { status: 'badge' },
      display: { price: 'money' },
      columns: ['title'],
      search: true,
    };
    expect(extended(props, undefined)).toBe(props);
    expect(
      extended<Props>(props, {
        // the action of the specs replaced in its place, not shown twice
        actions: [
          { id: 'export', label: 'Export' },
          { id: 'create', label: 'New task' },
        ],
        rowActions: [{ id: 'c', label: 'C' }],
        bulk: undefined,
        tiles: [{ id: 'mine', label: 'Mine' }],
        cells: { title: 'link' },
        values: { title: 'bold' },
        display: { price: 'percent' },
        columns: ['status'],
        search: undefined,
      }),
    ).toEqual({
      actions: [
        { id: 'create', label: 'New task' },
        { id: 'export', label: 'Export' },
      ],
      rowActions: [
        { id: 'a', label: 'A' },
        { id: 'c', label: 'C' },
      ],
      bulk: [{ id: 'b', label: 'B' }],
      tiles: [
        { id: 'drafts', label: 'Drafts' },
        { id: 'done', label: 'Done' },
        { id: 'mine', label: 'Mine' },
      ],
      cells: { status: 'badge', title: 'link' },
      values: { title: 'bold' },
      display: { price: 'percent' },
      columns: ['status'],
      search: undefined,
    });
  });

  it('gives a dashboard, the component that is its screen, the header through its slots only', () => {
    interface Home {
      title?: ReactNode;
      actions?: ReactNode;
      tiles?: readonly { id: string }[];
      recent?: readonly { id: string }[];
      charts?: ReactNode;
    }
    const extension: ScreenExtension<Home> = { actions: 'Export', props: { tiles: [{ id: 'mine' }] } };
    // @ts-expect-error the header of a dashboard is `actions` of the extension, never a prop
    const header: ScreenExtension<Home> = { props: { actions: 'Export', title: 'Mine' } };
    expect(extended<Home>({ tiles: [{ id: 'drafts' }] }, extension.props)).toEqual({ tiles: [{ id: 'drafts' }, { id: 'mine' }] });
    expect(header.props).toBeDefined();
  });
});
