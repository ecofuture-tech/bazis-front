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
// the card; and the props of an extension joined with the generated ones. Keep it passing
// when the component is changed.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { Screen } from '@/bazis/ui/app-shell';
import { ResourceCard, type ResourceCardProps } from '@/bazis/ui/resource-card';
import {
  CreateFormAction,
  extended,
  ScreenAction,
  useDestroyCardAction,
  UpdateFormAction,
  type CreateFormActionProps,
} from '@/bazis/ui/screens';
import { toast } from '@/bazis/ui/state-panel';
import { Backend, errors, ITEM_ID, ITEMS, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

// the toasts of the deletion, whatever their texts
vi.mock('@/bazis/ui/state-panel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/bazis/ui/state-panel')>()),
  toast: vi.fn(),
}));

const ITEM = `${ITEMS}${ITEM_ID}/`;

const createSchema = runtimeSchema({
  title: { attribute: { type: 'string', maxLength: 100, title: 'Title' }, required: true },
  day: { attribute: { type: 'string', format: 'date', title: 'Day' } },
});

/** A screen with a create form: a button opens it, another with a day fixed. */
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
      <CreateFormAction {...create} path={ITEMS as never} fields={['title']} title="New item" onSaved={onSaved} mode={mode} />
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

      // the click of a button opens it: its event is no fixed value
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

  it('sends the values it is opened with, and forgets them when opened again', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_create/`, createSchema)
      .on('POST', ITEMS, created('Visit'), 201);
    renderWithBazis(<Creating mode="dialog" />, backend);

    fireEvent.click(screen.getByTestId('action:add-day'));
    fireEvent.change(await screen.findByTestId('field:title'), { target: { value: 'Visit' } });
    // a fixed field that the form does not name is not shown
    expect(screen.queryByTestId('field:day')).toBeNull();
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(screen.queryByTestId('action:submit')).toBeNull();
    });
    expect(backend.calls.find((call) => call.method === 'POST')?.body).toEqual({
      data: { type: 'test.item', attributes: { title: 'Visit', day: '2026-10-18' }, relationships: {} },
    });

    fireEvent.click(screen.getByTestId('action:create'));
    fireEvent.change(await screen.findByTestId('field:title'), { target: { value: 'Other' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(backend.calls.filter((call) => call.method === 'POST')).toHaveLength(2);
    });
    expect(backend.calls.filter((call) => call.method === 'POST')[1]?.body).toEqual({
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
    const allowed = renderWithBazis(action, new Backend().on('GET', `${ITEMS}schema_create/`, createSchema));
    fireEvent.click(await screen.findByTestId('action:create'));
    expect(onClick).toHaveBeenCalledWith();
    allowed.unmount();

    const backend = new Backend().on('GET', `${ITEMS}schema_create/`, errors(403), 403);
    renderWithBazis(action, backend);
    await waitFor(() => {
      expect(backend.requests('GET')).toEqual([`GET ${ITEMS}schema_create/`]);
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
    expect(screen.getByRole('dialog').textContent).toContain('Delete it for good?');
    fireEvent.click(screen.getByTestId('action:confirm-delete'));
    expect(await screen.findByTestId('screen:item-list')).toBeTruthy();
    expect(backend.requests('DELETE')).toEqual([`DELETE ${ITEM}`]);
    expect(toast).toHaveBeenCalledWith({ title: expect.any(String) as unknown });
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

  it('says what the action describes and keeps the item when cancelled', async () => {
    function Described() {
      const destroy = useDestroyCardAction({
        id: 'delete',
        label: 'Delete',
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
          },
          {
            props: {
              actions: [{ id: 'added', label: 'Added', onClick: added }],
              children: (item, meta) => <p data-bz="added-child">{meta?.crud_actions?.join(',') ?? item.id}</p>,
              sections: [{ id: 'other', title: 'Other', fields: ['title'] }],
            },
          },
        )}
      />,
      cardBackend({ crud_actions: ['view'] }),
    );
    expect(await screen.findByTestId('state:loaded')).toBeTruthy();
    expect(screen.getByTestId('generated-child').textContent).toBe(ITEM_ID);
    expect(screen.getByTestId('added-child').textContent).toBe('view');
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
    render(<div data-bz="nodes">{node(extended<Props>({ children: 'generated' }, { props: { children: ' added' } }), ITEM_ID)}</div>);
    expect(screen.getByTestId('nodes').textContent).toBe('generated added');
    const mixed = extended<Props>({ children: 'generated' }, { props: { children: (id) => ` ${id}` } });
    render(<div data-bz="mixed">{node(mixed, ITEM_ID)}</div>);
    expect(screen.getByTestId('mixed').textContent).toBe(`generated ${ITEM_ID}`);
  });

  it('joins every kind of actions and keeps the generated props without an extension', () => {
    interface Props {
      rowActions?: readonly string[];
      bulk?: readonly string[];
      children?: unknown;
      columns: readonly string[];
      search?: boolean;
    }
    const props: Props = { rowActions: ['a'], bulk: ['b'], columns: ['title'], search: true };
    expect(extended(props, {})).toBe(props);
    expect(
      extended<Props>(props, { props: { rowActions: ['c'], bulk: undefined, columns: ['status'], search: undefined } }),
    ).toEqual({ rowActions: ['a', 'c'], bulk: ['b'], columns: ['status'], search: undefined });
  });
});
