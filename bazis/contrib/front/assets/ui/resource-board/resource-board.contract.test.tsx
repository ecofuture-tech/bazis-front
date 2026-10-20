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

// The contract of the board: `board:<entity>` with its states, a column `column:<status>` per
// status (a list filtered by it, the number of its items in `data-count`, more of them by
// `action:more`), its items `row:<id>` with their cells `cell:<field>`, opened by a click,
// with `move` moved by their menu (`action:move`, the transits that the user may run now:
// `move:<status>`, the transit itself when the contract does not know its status) and by a
// drop on a column (`BoardDragProvider`): the transit to its status, a dialog for its
// payload, the refusal shown (`error:move`). Keep it passing when the component is changed.

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { TRANSITS } from '@/bazis/generated/contract';
import { ITEM_META, useAnyItem } from '@/bazis/ui/resource';
import { BoardDragProvider, ResourceBoard, type BoardDrag } from '@/bazis/ui/resource-board';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const schema = runtimeSchema(
  {
    title: { attribute: { type: 'string', title: 'Title' } },
    count: { attribute: { type: 'integer', title: 'Count' } },
    late: { attribute: { type: 'boolean', title: 'Late' } },
    status: { relation: 'statusy.status' },
  },
  { list: true },
);

const task = (id: string, status: string, extra: Record<string, unknown> = {}, type = 'test.item') =>
  resource(id, { title: `Task ${id}`, count: 2, late: false, ...extra }, { status: { type: 'statusy.status', id: status } }, type);

/** A list of the board with the transits that the user may run on its items (`for_transit`). */
const moving = (items: readonly unknown[], forTransit: Record<string, readonly string[]>, count?: number) =>
  listDocument(items, { meta: { for_transit: forTransit }, ...(count === undefined ? {} : { count }) });

function backend(list: unknown, status = 200, transit: [unknown, number] = [{ data: task('a', 'done') }, 200]) {
  return new Backend()
    .on('GET', `${ITEMS}schema_list/`, schema)
    .on('GET', ITEMS, list, status)
    .on('POST', `${ITEMS}a/transit/`, ...transit);
}

const board = (props: Partial<Parameters<typeof ResourceBoard>[0]> = {}) => (
  <ResourceBoard path={ITEMS as never} entity="item" columns={['draft', 'done']} title="title" fields={['count']} {...props} />
);

function open(trigger: HTMLElement) {
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

const lists = (server: Backend) =>
  server
    .requests('GET')
    .filter((it) => it.startsWith(`GET ${ITEMS}?`))
    .map((it) => decodeURIComponent(it));

// a transit of the contract of the product that takes a payload, if it has one: the board
// asks for it with the JSON Schema of the contract (`for_transit` gives the ids only)
const CONTRACT: Readonly<
  Record<string, { transits: readonly { id: string; dst: string; payload: { schema: { properties?: object } } | null }[] }>
> = TRANSITS;
const WITH_PAYLOAD = Object.entries(CONTRACT).flatMap(([type, model]) =>
  model.transits.flatMap((it) => (it.payload ? [{ type, transit: it.id, dst: it.dst, fields: Object.keys(it.payload.schema.properties ?? {}) }] : [])),
)[0];

/** The state actions of an item of a type of the contract: its transit with the payload of a note titled `title`. */
function noteAction(type: string, transit: string, title: string) {
  const payload = { type: 'object', properties: { note: { type: 'string', title } } };
  return {
    code: 'ACTION_TRANSIT',
    endpoint: {
      url: `${ITEMS}a/transit/`,
      method: 'POST',
      body: { type: 'object', properties: { transit: { type: 'string', default: transit }, payload } },
    },
    restricts: null,
    resource: { type, id: 'a' },
  };
}

/** The card of the item `a`, as `ResourceCard` reads it, with a link to the board. */
function ItemCard({ onBoard }: { onBoard: () => void }) {
  const item = useAnyItem(ITEMS, 'a', { meta: ITEM_META });
  return (
    <button type="button" data-bz="action:to-board" disabled={!item.data} onClick={onBoard}>
      Board
    </button>
  );
}

/** The card of the item `a` until the board replaces it (`action:to-board`). */
function CardThenBoard({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return shown ? (
    children
  ) : (
    <ItemCard
      onBoard={() => {
        setShown(true);
      }}
    />
  );
}

describe('ResourceBoard', () => {
  it('is loading, then shows a column per status, its items, its number and more of them', async () => {
    const pending = renderWithBazis(board(), new Backend().hold('GET', ITEMS).on('GET', `${ITEMS}schema_list/`, schema));
    expect(within(screen.getByTestId('board:item')).getByTestId('state:loading')).toBeTruthy();
    pending.unmount();

    const server = backend(listDocument([task('a', 'draft', { late: true })], { count: 3 }));
    renderWithBazis(board({ badge: 'late', pageSize: 1 }), server);
    const draft = await screen.findByTestId('column:draft');
    expect(draft.getAttribute('data-count')).toBe('3');
    expect(screen.getByTestId('column:done')).toBeTruthy();
    const row = within(draft).getByTestId('row:a');
    expect(within(row).getByTestId('cell:title').textContent).toBe('Task a');
    expect(within(row).getByTestId('cell:count').textContent).toBe('2');
    // the badge of a field while it is true
    expect(row.textContent).toContain('Late');
    // a list per column, filtered by its status
    expect(lists(server).some((it) => it.includes('status=draft'))).toBe(true);
    expect(lists(server).some((it) => it.includes('status=done'))).toBe(true);
    fireEvent.click(within(draft).getByTestId('action:more'));
    await waitFor(() => {
      expect(lists(server).some((it) => it.includes('status=draft') && it.includes('page[limit]=2'))).toBe(true);
    });
  });

  it('marks an empty board, an error and a forbidden one', async () => {
    const empty = renderWithBazis(board(), backend(listDocument([])));
    expect(await within(screen.getByTestId('board:item')).findByTestId('state:empty')).toBeTruthy();
    empty.unmount();
    const failed = renderWithBazis(board(), backend(errors(500), 500));
    expect(await screen.findByTestId('state:error')).toBeTruthy();
    failed.unmount();
    renderWithBazis(board(), backend(errors(403), 403));
    expect(await screen.findByTestId('state:forbidden')).toBeTruthy();
  });

  it('opens an item by a click, not by its menu, and moves it by a transit of its menu', async () => {
    const onOpen = vi.fn();
    const server = backend(moving([task('a', 'draft')], { a: ['start'] }));
    renderWithBazis(board({ onOpen, columns: ['draft'], move: true }), server);
    const row = await screen.findByTestId('row:a');
    open(within(row).getByTestId('action:move'));
    fireEvent.click(await screen.findByTestId('move:start'));
    await waitFor(() => {
      expect(server.calls.find((it) => it.method === 'POST')?.body).toEqual({ transit: 'start' });
    });
    // a transit without a payload runs without reading the item
    expect(server.requests('GET').filter((it) => it.startsWith(`GET ${ITEMS}a/`))).toEqual([]);
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole('button', { name: 'Task a' }));
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('reads the transits of the cards with the lists of the columns, not of each card', async () => {
    const server = backend(moving([task('a', 'draft'), task('b', 'draft')], { a: ['start'], b: ['start'] }));
    renderWithBazis(board({ columns: ['draft'], move: true }), server);
    await screen.findByTestId('row:b');
    expect(lists(server).every((it) => it.includes('meta=pagination,for_transit'))).toBe(true);
    open(within(screen.getByTestId('row:a')).getByTestId('action:move'));
    expect(await screen.findByTestId('move:start')).toBeTruthy();
    expect(server.requests('GET').filter((it) => /\/item\/[ab]\//.test(it))).toEqual([]);
  });

  it('lists the moves in the order of the specs, and asks to confirm a transit that they confirm', async () => {
    const server = backend(moving([task('a', 'draft')], { a: ['finish', 'start'] }));
    renderWithBazis(board({ columns: ['draft'], move: true, transits: [{ id: 'start', confirm: true }, { id: 'finish' }] }), server);
    open(within(await screen.findByTestId('row:a')).getByTestId('action:move'));
    await screen.findByTestId('move:start');
    const moves = screen.getAllByRole('menuitem').map((it) => it.getAttribute('data-bz'));
    expect(moves).toEqual(['move:start', 'move:finish']);
    fireEvent.click(screen.getByTestId('move:start'));
    fireEvent.click(await screen.findByTestId('action:confirm-start'));
    await waitFor(() => {
      expect(server.calls.find((it) => it.method === 'POST')?.body).toEqual({ transit: 'start' });
    });
  });

  it.runIf(WITH_PAYLOAD)('asks for the payload of a transit of the contract in a dialog, by the schema of the contract without the item', async () => {
    if (!WITH_PAYLOAD) return;
    const { type, transit, dst, fields } = WITH_PAYLOAD;
    const server = backend(moving([task('a', 'draft', {}, type)], { a: [transit] }));
    renderWithBazis(board({ columns: ['draft'], move: true }), server);
    open(within(await screen.findByTestId('row:a')).getByTestId('action:move'));
    fireEvent.click(await screen.findByTestId(`move:${dst}`));
    for (const name of fields) expect(await screen.findByTestId(`field:${name}`)).toBeTruthy();
  });

  it.runIf(WITH_PAYLOAD)('reads the payload of a transit of the item as its dialog opens, in the request of its card', async () => {
    if (!WITH_PAYLOAD) return;
    const { type, transit, dst } = WITH_PAYLOAD;
    // the schema of the backend, in the language of the user: its titles, not those of the contract
    const action = noteAction(type, transit, 'A note of the backend');
    const list = moving([task('a', 'draft', {}, type)], { a: [transit] });
    const reading = renderWithBazis(board({ columns: ['draft'], move: true }), backend(list).hold('GET', `${ITEMS}a/`));
    open(within(await screen.findByTestId('row:a')).getByTestId('action:move'));
    fireEvent.click(await screen.findByTestId(`move:${dst}`));
    // no fields while the item is read
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('state:loading')).toBeTruthy();
    expect(within(dialog).queryByTestId(/^field:/)).toBeNull();
    reading.unmount();

    const server = backend(list).on('GET', `${ITEMS}a/`, { data: task('a', 'draft', {}, type), meta: { state_actions: [action] } });
    renderWithBazis(board({ columns: ['draft'], move: true }), server);
    open(within(await screen.findByTestId('row:a')).getByTestId('action:move'));
    fireEvent.click(await screen.findByTestId(`move:${dst}`));
    expect((await screen.findByLabelText('A note of the backend')).getAttribute('data-bz')).toBe('field:note');
    expect(server.requests('GET').filter((it) => it.startsWith(`GET ${ITEMS}a/`)).map((it) => decodeURIComponent(it))).toEqual([
      `GET ${ITEMS}a/?meta=${ITEM_META.join(',')}`,
    ]);
  });

  it.runIf(WITH_PAYLOAD)('reads the item again over the data that its card read before, in another status', async () => {
    if (!WITH_PAYLOAD) return;
    const { type, transit, dst } = WITH_PAYLOAD;
    const server = backend(moving([task('a', 'draft', {}, type)], { a: [transit] })).on('GET', `${ITEMS}a/`, {
      data: task('a', 'draft', {}, type),
      meta: { state_actions: [noteAction(type, transit, 'A note of before')] },
    });
    renderWithBazis(<CardThenBoard>{board({ columns: ['draft'], move: true })}</CardThenBoard>, server);
    // the card read the item, then the board replaces it; the item has changed since
    const toBoard = await screen.findByTestId('action:to-board');
    await waitFor(() => {
      expect(toBoard.hasAttribute('disabled')).toBe(false);
    });
    server.on('GET', `${ITEMS}a/`, {
      data: task('a', 'draft', {}, type),
      meta: { state_actions: [noteAction(type, transit, 'A note of now')] },
    });
    fireEvent.click(toBoard);
    open(within(await screen.findByTestId('row:a')).getByTestId('action:move'));
    fireEvent.click(await screen.findByTestId(`move:${dst}`));
    expect((await screen.findByLabelText('A note of now')).getAttribute('data-bz')).toBe('field:note');
    // the read of the card, then that of the dialog
    expect(server.requests('GET').filter((it) => it.startsWith(`GET ${ITEMS}a/`))).toHaveLength(2);
  });

  it('shows the refusal of a move by its menu', async () => {
    renderWithBazis(board({ columns: ['draft'], move: true }), backend(moving([task('a', 'draft')], { a: ['start'] }), 200, [errors(403), 403]));
    const row = await screen.findByTestId('row:a');
    expect(screen.queryByTestId('error:move')).toBeNull();
    open(within(row).getByTestId('action:move'));
    fireEvent.click(await screen.findByTestId('move:start'));
    const refused = await screen.findByTestId('error:move');
    expect(within(refused).getByTestId('state:forbidden')).toBeTruthy();
    // the item stays where it was
    expect(within(screen.getByTestId('column:draft')).getByTestId('row:a')).toBeTruthy();
  });

  /** A drag and drop that gives the test the drop of the board, and marks the cards it drags. */
  function dragOf(): { drag: BoardDrag; drop: (id: string, status: string) => void } {
    let dropped: ((id: string, status: string) => void) | undefined;
    const drag: BoardDrag = {
      Area: ({ onDrop, children }) => {
        dropped = onDrop;
        return children;
      },
      Column: ({ children }: { children: ReactNode }) => children,
      Card: ({ id, children }: { id: string; children: ReactNode }) => <div data-bz={`drag:${id}`}>{children}</div>,
    };
    return { drag, drop: (id, status) => dropped?.(id, status) };
  }

  it('gives a card without a transit neither its menu nor its drag', async () => {
    const { drag } = dragOf();
    renderWithBazis(
      <BoardDragProvider drag={drag}>{board({ columns: ['draft'], move: true })}</BoardDragProvider>,
      backend(moving([task('a', 'draft'), task('b', 'draft')], { b: ['start'] })),
    );
    const row = await screen.findByTestId('row:a');
    expect(within(row).queryByTestId('action:move')).toBeNull();
    expect(screen.queryByTestId('drag:a')).toBeNull();
    expect(within(screen.getByTestId('row:b')).getByTestId('action:move')).toBeTruthy();
    expect(screen.getByTestId('drag:b')).toBeTruthy();
  });

  it('runs the transit of a card dropped on a column whose status it leads to, and shows its refusal', async () => {
    const { drag, drop } = dragOf();
    const server = backend(moving([task('a', 'draft')], { a: ['start'] }));
    const moved = renderWithBazis(<BoardDragProvider drag={drag}>{board({ columns: ['draft', 'start', 'done'], move: true })}</BoardDragProvider>, server);
    await screen.findAllByTestId('row:a');
    // a column that no transit of the card leads to: nothing is sent
    drop('a', 'done');
    // the contract of the tests knows no status of its transits: the transit names the column
    drop('a', 'start');
    await waitFor(() => {
      expect(server.calls.filter((it) => it.method === 'POST').map((it) => it.body)).toEqual([{ transit: 'start' }]);
    });
    moved.unmount();

    const refusing = dragOf();
    renderWithBazis(
      <BoardDragProvider drag={refusing.drag}>{board({ columns: ['draft', 'start'], move: true })}</BoardDragProvider>,
      backend(moving([task('a', 'draft')], { a: ['start'] }), 200, [errors(422), 422]),
    );
    await screen.findAllByTestId('row:a');
    refusing.drop('a', 'start');
    expect(within(await screen.findByTestId('error:move')).getByTestId('state:invalid')).toBeTruthy();
  });

  it('moves no card without `move`: no transits read, no menu, no drag and drop', async () => {
    const { drag, drop } = dragOf();
    const server = backend(moving([task('a', 'draft')], { a: ['start'] }));
    renderWithBazis(<BoardDragProvider drag={drag}>{board({ columns: ['draft', 'start'] })}</BoardDragProvider>, server);
    await screen.findAllByTestId('row:a');
    expect(lists(server).every((it) => !it.includes('for_transit'))).toBe(true);
    expect(screen.queryByTestId('action:move')).toBeNull();
    drop('a', 'start');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.calls.some((it) => it.method === 'POST')).toBe(false);
  });
});
