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
import type { ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { BoardDragProvider, ResourceBoard, type BoardDrag } from '@/bazis/ui/resource-board';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

// the menus are positioned with ResizeObserver, which jsdom does not have
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

const task = (id: string, status: string, extra: Record<string, unknown> = {}) =>
  resource(id, { title: `Task ${id}`, count: 2, late: false, ...extra }, { status: { type: 'statusy.status', id: status } });

function action(id: string, transit: string, payload: unknown) {
  return {
    code: 'ACTION_TRANSIT',
    endpoint: { url: `${ITEMS}${id}/transit/`, method: 'POST', body: { type: 'object', properties: { transit: { type: 'string', default: transit }, payload } } },
    restricts: null,
    resource: { type: 'test.item', id },
  };
}

const NO_PAYLOAD = { anyOf: [{ type: 'object' }, { type: 'null' }] };
const REPORT = { type: 'object', required: ['report'], properties: { report: { type: 'string', title: 'Report' } } };

function backend(list: unknown, status = 200, transit: [unknown, number] = [{ data: task('a', 'done') }, 200]) {
  return new Backend()
    .on('GET', `${ITEMS}schema_list/`, schema)
    .on('GET', ITEMS, list, status)
    .on('GET', `${ITEMS}a/`, { data: task('a', 'draft'), meta: { state_actions: [action('a', 'start', NO_PAYLOAD), action('a', 'finish', REPORT)] } })
    .on('POST', `${ITEMS}a/transit/`, ...transit);
}

const board = (props: Partial<Parameters<typeof ResourceBoard>[0]> = {}) => (
  <ResourceBoard path={ITEMS as never} entity="item" columns={['draft', 'done']} title="title" fields={['count']} {...props} />
);

function open(trigger: HTMLElement) {
  fireEvent.keyDown(trigger, { key: 'Enter' });
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
    const lists = server.requests('GET').filter((it) => it.startsWith(`GET ${ITEMS}?`)).map((it) => decodeURIComponent(it));
    expect(lists.some((it) => it.includes('status=draft'))).toBe(true);
    expect(lists.some((it) => it.includes('status=done'))).toBe(true);
    fireEvent.click(within(draft).getByTestId('action:more'));
    await waitFor(() => {
      expect(server.requests('GET').map((it) => decodeURIComponent(it)).some((it) => it.includes('status=draft') && it.includes('page[limit]=2'))).toBe(true);
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
    const server = backend(listDocument([task('a', 'draft')]));
    renderWithBazis(board({ onOpen, columns: ['draft'], move: true }), server);
    const row = await screen.findByTestId('row:a');
    open(within(row).getByTestId('action:move'));
    fireEvent.click(await screen.findByTestId('move:start'));
    await waitFor(() => {
      expect(server.calls.find((it) => it.method === 'POST')?.body).toEqual({ transit: 'start' });
    });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole('button', { name: 'Task a' }));
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('lists the moves in the order of the specs, and asks to confirm a transit that they confirm', async () => {
    const server = backend(listDocument([task('a', 'draft')]));
    renderWithBazis(board({ columns: ['draft'], move: true, transits: [{ id: 'finish' }, { id: 'start', confirm: true }] }), server);
    open(within(await screen.findByTestId('row:a')).getByTestId('action:move'));
    await screen.findByTestId('move:start');
    const moves = screen.getAllByRole('menuitem').map((it) => it.getAttribute('data-bz'));
    expect(moves).toEqual(['move:finish', 'move:start']);
    fireEvent.click(screen.getByTestId('move:start'));
    fireEvent.click(await screen.findByTestId('action:confirm-start'));
    await waitFor(() => {
      expect(server.calls.find((it) => it.method === 'POST')?.body).toEqual({ transit: 'start' });
    });
  });

  it('asks for the payload of a transit in a dialog', async () => {
    renderWithBazis(board({ columns: ['draft'], move: true }), backend(listDocument([task('a', 'draft')])));
    open(within(await screen.findByTestId('row:a')).getByTestId('action:move'));
    fireEvent.click(await screen.findByTestId('move:finish'));
    expect(await screen.findByTestId('field:report')).toBeTruthy();
  });

  it('shows the refusal of a move by its menu', async () => {
    renderWithBazis(board({ columns: ['draft'], move: true }), backend(listDocument([task('a', 'draft')]), 200, [errors(403), 403]));
    const row = await screen.findByTestId('row:a');
    expect(screen.queryByTestId('error:move')).toBeNull();
    open(within(row).getByTestId('action:move'));
    fireEvent.click(await screen.findByTestId('move:start'));
    const refused = await screen.findByTestId('error:move');
    expect(within(refused).getByTestId('state:forbidden')).toBeTruthy();
    // the item stays where it was
    expect(within(screen.getByTestId('column:draft')).getByTestId('row:a')).toBeTruthy();
  });

  it('reads the transits of a card when its menu opens, not with the board', async () => {
    const server = backend(listDocument([task('a', 'draft'), task('b', 'draft'), task('c', 'draft')]));
    renderWithBazis(board({ columns: ['draft'], move: true }), server);
    await screen.findByTestId('row:c');
    expect(screen.getAllByTestId('action:move')).toHaveLength(3);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const items = () => server.requests('GET').filter((it) => /\/item\/[abc]\//.test(it));
    expect(items()).toEqual([]);
    open(within(screen.getByTestId('row:a')).getByTestId('action:move'));
    expect(await screen.findByTestId('move:start')).toBeTruthy();
    expect(items()).toEqual([`GET ${ITEMS}a/?meta=state_actions`]);
  });

  it('says when a card has no transit once its menu opens', async () => {
    const server = backend(listDocument([task('a', 'draft')])).on('GET', `${ITEMS}a/`, { data: task('a', 'draft'), meta: { state_actions: [] } });
    renderWithBazis(board({ columns: ['draft'], move: true }), server);
    open(await within(await screen.findByTestId('row:a')).findByTestId('action:move'));
    expect(await screen.findByText('No moves now')).toBeTruthy();
    expect(screen.queryByTestId('move:start')).toBeNull();
  });

  /** A drag and drop that gives the test the drop of the board. */
  function dragOf(): { drag: BoardDrag; drop: (id: string, status: string) => void } {
    let dropped: ((id: string, status: string) => void) | undefined;
    const drag: BoardDrag = {
      Area: ({ onDrop, children }) => {
        dropped = onDrop;
        return children;
      },
      Column: ({ children }: { children: ReactNode }) => children,
      Card: ({ children }: { children: ReactNode }) => children,
    };
    return { drag, drop: (id, status) => dropped?.(id, status) };
  }

  it('runs the transit of a card dropped on a column whose status it leads to, and shows its refusal', async () => {
    const { drag, drop } = dragOf();
    const server = backend(listDocument([task('a', 'draft')]));
    const moved = renderWithBazis(<BoardDragProvider drag={drag}>{board({ columns: ['draft', 'start'], move: true })}</BoardDragProvider>, server);
    await screen.findAllByTestId('row:a');
    // the contract of the tests knows no status of its transits: the transit names the column
    drop('a', 'start');
    await waitFor(() => {
      expect(server.calls.find((it) => it.method === 'POST')?.body).toEqual({ transit: 'start' });
    });
    moved.unmount();

    const refusing = dragOf();
    renderWithBazis(
      <BoardDragProvider drag={refusing.drag}>{board({ columns: ['draft', 'start'], move: true })}</BoardDragProvider>,
      backend(listDocument([task('a', 'draft')]), 200, [errors(422), 422]),
    );
    await screen.findAllByTestId('row:a');
    refusing.drop('a', 'start');
    expect(within(await screen.findByTestId('error:move')).getByTestId('state:invalid')).toBeTruthy();
  });

  it('moves no card without `move`: no menu, no drag and drop', async () => {
    const { drag, drop } = dragOf();
    const server = backend(listDocument([task('a', 'draft')]));
    renderWithBazis(<BoardDragProvider drag={drag}>{board({ columns: ['draft', 'start'] })}</BoardDragProvider>, server);
    await screen.findAllByTestId('row:a');
    expect(screen.queryByTestId('action:move')).toBeNull();
    drop('a', 'start');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.calls.some((it) => it.method === 'POST')).toBe(false);
  });
});
