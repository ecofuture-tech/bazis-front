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

// The contract of the list of a resource: `list:<entity>`, its states (`loading`, `empty`,
// `error`, `forbidden`, `loaded`), `row:<id>` that opens the item with its cells
// `cell:<column>` (the end-to-end tests find a row by them; a filter is `field:<name>`),
// the titles of the list schema, the actions the backend allows (`action:<id>`), search,
// filters and pages, its first columns only next to an open card. Keep it passing when the
// component is changed.

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ListCardLayout } from '@/bazis/ui/app-shell';
import { filterOf, ResourceList } from '@/bazis/ui/resource-list';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

const schema = runtimeSchema(
  {
    title: { attribute: { type: 'string', title: 'Title' } },
    done: { attribute: { type: 'boolean', title: 'Done' } },
    count: { attribute: { type: 'integer', title: 'Count' } },
  },
  { list: true },
);

function backend(list: unknown, status = 200) {
  return new Backend()
    .on('GET', `${ITEMS}schema_list/`, schema)
    .on('GET', `${ITEMS}route_filter_fields/`, { fields: [{ name: 'title', py_type: 'string' }] })
    .on('GET', ITEMS, list, status);
}

/** Whether a list was requested with this decoded parameter. */
function requested(server: Backend, parameter: string): boolean {
  return server.requests('GET').some((it) => decodeURIComponent(it).includes(parameter));
}

const rows = [resource('a', { title: 'First', done: true, count: 1 }), resource('b', { title: 'Second', done: false, count: null })];

describe('ResourceList', () => {
  it('is loading, then lists the rows with the titles of the schema', async () => {
    const pending = new Backend().hold('GET', ITEMS).on('GET', `${ITEMS}schema_list/`, schema);
    const { unmount } = renderWithBazis(<ResourceList path={ITEMS as never} entity="item" columns={['title']} />, pending);
    // the skeleton of the rows is the loading state
    const loading = within(screen.getByTestId('list:item')).getByTestId('state:loading');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    unmount();

    const onOpen = vi.fn();
    renderWithBazis(
      <ResourceList path={ITEMS as never} entity="item" columns={['title', 'done']} onOpen={onOpen} layout="table" />,
      backend(listDocument(rows)),
    );
    const loaded = await screen.findByTestId('state:loaded');
    expect(within(loaded).getByTestId('row:a').textContent).toContain('First');
    expect(await within(loaded).findByText('Title')).toBeTruthy();
    expect(within(screen.getByTestId('row:a')).getByTestId('cell:title').textContent).toBe('First');
    expect(within(screen.getByTestId('row:a')).getByTestId('cell:done').textContent).toBe('Yes');
    fireEvent.click(screen.getByTestId('row:b'));
    expect(onOpen).toHaveBeenCalledWith('b');
    fireEvent.keyDown(screen.getByTestId('row:a'), { key: 'Enter' });
    expect(onOpen).toHaveBeenLastCalledWith('a');
  });

  it('marks an empty list, a forbidden one and an error', async () => {
    const { unmount } = renderWithBazis(
      <ResourceList path={ITEMS as never} entity="item" columns={['title']} />,
      backend(listDocument([])),
    );
    expect(await screen.findByTestId('state:empty')).toBeTruthy();
    unmount();
    const forbidden = renderWithBazis(
      <ResourceList path={ITEMS as never} entity="item" columns={['title']} />,
      backend(errors(403), 403),
    );
    expect(await screen.findByTestId('state:forbidden')).toBeTruthy();
    forbidden.unmount();
    renderWithBazis(<ResourceList path={ITEMS as never} entity="item" columns={['title']} />, backend(errors(500), 500));
    expect(await screen.findByTestId('state:error')).toBeTruthy();
  });

  it('shows the actions the backend allows', async () => {
    const remove = vi.fn();
    const document = listDocument(rows, { meta: { for_create: false, for_change: [], for_delete: ['a'] } });
    renderWithBazis(
      <ResourceList
        path={ITEMS as never}
        entity="item"
        columns={['title']}
        actions={[
          { id: 'create', label: 'Create', onClick: vi.fn(), permission: 'add' },
          { id: 'export', label: 'Export', onClick: vi.fn() },
        ]}
        rowActions={[{ id: 'delete', label: 'Delete', onClick: remove, permission: 'delete' }]}
      />,
      backend(document),
    );
    await screen.findByTestId('state:loaded');
    expect(screen.queryByTestId('action:create')).toBeNull();
    expect(screen.getByTestId('action:export')).toBeTruthy();
    expect(within(screen.getByTestId('row:b')).queryByTestId('action:delete')).toBeNull();
    fireEvent.click(within(screen.getByTestId('row:a')).getByTestId('action:delete'));
    expect(remove).toHaveBeenCalledWith('a');
  });

  it('does not open a row with the keyboard of its actions', async () => {
    const onOpen = vi.fn();
    renderWithBazis(
      <ResourceList
        path={ITEMS as never}
        entity="item"
        columns={['title']}
        onOpen={onOpen}
        rowActions={[{ id: 'delete', label: 'Delete', onClick: vi.fn() }]}
      />,
      backend(listDocument(rows)),
    );
    await screen.findByTestId('state:loaded');
    fireEvent.keyDown(within(screen.getByTestId('row:a')).getByTestId('action:delete'), { key: 'Enter' });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('filters by the types of route_filter_fields/ of the core', () => {
    const types = new Map([
      ['price', 'Decimal'],
      ['rate', 'number'],
      ['count', 'integer'],
      ['done', 'boolean'],
      ['day', 'date'],
      ['dt', 'datetime'],
      ['title', 'string'],
      ['owner', '/api/v1/users/user/'],
      ['state', 'unknown'],
    ]);
    const filters = [...types.keys()].map((field) => ({ field }));
    const values = {
      price: '10.10', rate: '0.5', count: '3', done: 'false', day__gte: '2026-01-01', dt__lte: '2026-01-31',
      title: 'two words', owner: 'u1', state: 'draft',
    };
    expect(decodeURIComponent(decodeURIComponent(filterOf(filters, values, types)?.toString() ?? ''))).toBe(
      'price=10.10&rate=0.5&count=3&done=false&day__gte=2026-01-01&dt__lte=2026-01-31T23:59:59' +
        '&title__$search=two words&owner=u1&state=draft',
    );
    expect(filterOf(filters, {}, types)).toBeUndefined();
  });

  it('renders the numeric filters as numbers', async () => {
    const server = backend(listDocument(rows)).on('GET', `${ITEMS}route_filter_fields/`, {
      fields: [{ name: 'price', py_type: 'Decimal' }, { name: 'rate', py_type: 'number' }],
    });
    renderWithBazis(
      <ResourceList path={ITEMS as never} entity="item" columns={['title']} filters={['price', 'rate']} />,
      server,
    );
    await waitFor(() => {
      expect(screen.getByTestId<HTMLInputElement>('field:price').type).toBe('number');
    });
    expect(screen.getByTestId<HTMLInputElement>('field:rate').type).toBe('number');
  });

  it('requests the search, the filters and the next page', async () => {
    const server = backend(listDocument(rows, { count: 45, next: `${ITEMS}?page%5Blimit%5D=20&page%5Boffset%5D=20` }));
    renderWithBazis(
      <ResourceList path={ITEMS as never} entity="item" columns={['title']} search filters={['title']} />,
      server,
    );
    await screen.findByTestId('state:loaded');
    expect(screen.getByRole('navigation', { name: 'Pages' }).textContent).toContain('1–2 of 45');

    fireEvent.click(screen.getByTestId('action:next-page'));
    await waitFor(() => {
      expect(requested(server, 'page[offset]=20')).toBe(true);
    });

    fireEvent.change(await screen.findByTestId('field:title'), { target: { value: 'rep' } });
    await waitFor(() => {
      expect(requested(server, 'filter=title__$search=rep')).toBe(true);
    });

    fireEvent.change(screen.getByTestId('field:$search'), { target: { value: 'word' } });
    await waitFor(() => {
      expect(requested(server, 'search=word')).toBe(true);
    });
  });

  for (const layout of ['table', 'cards'] as const) {
    it(`marks the rows and their cells as ${layout}, the open one selected`, async () => {
      const onOpen = vi.fn();
      renderWithBazis(
        <ResourceList
          path={ITEMS as never}
          entity="item"
          columns={['title', 'done']}
          layout={layout}
          selected="b"
          onOpen={onOpen}
        />,
        backend(listDocument(rows)),
      );
      await screen.findByTestId('state:loaded');
      expect(within(screen.getByTestId('row:a')).getByTestId('cell:title').textContent).toBe('First');
      expect(within(screen.getByTestId('row:b')).getByTestId('cell:done').textContent).toBe('No');
      expect(screen.getByTestId('row:b').getAttribute('data-state')).toBe('selected');
      expect(screen.getByTestId('row:a').getAttribute('data-state')).toBeNull();
      fireEvent.click(screen.getByTestId('row:a'));
      expect(onOpen).toHaveBeenCalledWith('a');
    });
  }

  it('shows a skeleton of the filters until their types and titles are loaded', async () => {
    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, schema)
      .hold('GET', `${ITEMS}route_filter_fields/`)
      .on('GET', ITEMS, listDocument(rows));
    const { container } = renderWithBazis(
      <ResourceList path={ITEMS as never} entity="item" columns={['title']} filters={['title']} />,
      server,
    );
    await screen.findByTestId('state:loaded');
    expect(screen.queryByTestId('field:title')).toBeNull();
    expect(container.querySelector('[data-filter-skeleton]')).not.toBeNull();
  });

  it('tells that nothing matches the search, not that there is nothing', async () => {
    const server = backend(listDocument([]));
    renderWithBazis(
      <ResourceList path={ITEMS as never} entity="item" columns={['title']} search emptyMessage="No items yet." />,
      server,
    );
    expect((await screen.findByTestId('state:empty')).textContent).toContain('No items yet.');
    fireEvent.change(screen.getByTestId('field:$search'), { target: { value: 'word' } });
    await waitFor(() => {
      expect(screen.getByTestId('state:empty').textContent).toContain('Nothing matches');
    });
    expect(screen.getByTestId('state:empty').textContent).not.toContain('No items yet.');
  });

  it('keeps every column of a wide table in its own scroll area', async () => {
    renderWithBazis(<ResourceList path={ITEMS as never} entity="item" columns={['title', 'done']} layout="table" />, backend(listDocument(rows)));
    const loaded = await screen.findByTestId('state:loaded');
    const area = loaded.querySelector('[data-slot="table-scroll"]');
    expect(area?.className).toContain('overflow-auto');
    // the header sticks at the top of the area
    expect(loaded.querySelector('th')?.className).toContain('sticky');
  });

  it('shows only its first columns next to an open card, keeping the cells', async () => {
    const columns = ['title', 'done', 'count'];
    function List() {
      return <ResourceList path={ITEMS as never} entity="item" columns={columns} layout="table" />;
    }
    renderWithBazis(
      <Routes>
        <Route path="/items" element={<ListCardLayout mode="split" list={<List />} />}>
          <Route path=":id" element={<p>card</p>} />
        </Route>
      </Routes>,
      backend(listDocument(rows)),
      { route: '/items/a' },
    );
    const loaded = await screen.findByTestId('state:loaded');
    const headers = [...loaded.querySelectorAll('th')];
    expect(headers.map((it) => it.classList.contains('hidden'))).toEqual([false, false, true]);
    const row = within(screen.getByTestId('row:a'));
    expect(row.getByTestId('cell:title').classList.contains('hidden')).toBe(false);
    // the cell of a hidden column is still there, for the scenarios that look a row up by it
    expect(row.getByTestId('cell:count').classList.contains('hidden')).toBe(true);
  });

  it('leaves out a column whose field no row has (hidden by the field permissions)', async () => {
    // the schema of a list has every field; the items leave out those the user may not see
    const hidden = [resource('a', { title: 'First', done: true }), resource('b', { title: 'Second' })];
    renderWithBazis(
      <ResourceList path={ITEMS as never} entity="item" columns={['title', 'count', 'done']} layout="table" />,
      backend(listDocument(hidden)),
    );
    const loaded = await screen.findByTestId('state:loaded');
    expect([...loaded.querySelectorAll('th')].map((it) => it.textContent)).toEqual(['Title', 'Done']);
    expect(within(screen.getByTestId('row:a')).queryByTestId('cell:count')).toBeNull();
    // a row without the field of a shown column (another group of permissions): no value
    expect(within(screen.getByTestId('row:b')).getByTestId('cell:done').textContent).toBe('—');
  });

  it('shows every column without a card', async () => {
    renderWithBazis(
      <Routes>
        <Route
          path="/items"
          element={<ListCardLayout mode="split" list={<ResourceList path={ITEMS as never} entity="item" columns={['title', 'done', 'count']} layout="table" />} />}
        />
      </Routes>,
      backend(listDocument(rows)),
      { route: '/items' },
    );
    const loaded = await screen.findByTestId('state:loaded');
    expect([...loaded.querySelectorAll('th')].some((it) => it.classList.contains('hidden'))).toBe(false);
  });
});
