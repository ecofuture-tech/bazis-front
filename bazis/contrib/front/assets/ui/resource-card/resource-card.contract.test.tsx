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

// The contract of the card of an item: its states (`loading`, its skeleton, `forbidden`,
// `not_found`, `error`, `loaded`), `field:<name>` of its values with the titles of the
// retrieve schema (only the fields it has: the field permissions of the user), the fields
// that its edit does not change marked read-only, the actions the backend allows and the
// edit (`action:edit`, then the form, in a dialog or as a page); a related section
// (`RelatedList`): the related items of the item, `action:<id>` that adds one with the
// relationship fixed to the item and reads the item of the card again (in the children of the
// card or after it), the actions of its rows; the tabs `tab:<id>` of its sections and its
// content. Keep it passing when the component is changed.

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Screen } from '@/bazis/ui/app-shell';
import { permitted } from '@/bazis/ui/resource';
import { RelatedList, ResourceCard } from '@/bazis/ui/resource-card';
import {
  Backend,
  errors,
  ITEM_ID,
  ITEMS,
  listDocument,
  renderWithBazis,
  resource,
  runtimeSchema,
  testLanguages,
} from '@/bazis/ui/testing';

const ITEM = `${ITEMS}${ITEM_ID}/`;
const schema = runtimeSchema({
  title: { attribute: { type: 'string', maxLength: 100, title: 'Title' } },
  count: { attribute: { type: 'integer', title: 'Count' } },
});
const sections = [{ id: 'main', title: 'Main', fields: ['title', 'count'] }];

function backend(meta: unknown) {
  return new Backend()
    .on('GET', `${ITEM}schema_retrieve/`, schema)
    .on('GET', `${ITEM}schema_update/`, schema)
    .on('GET', ITEM, { data: resource(ITEM_ID, { title: 'Report', count: 3 }), meta });
}

describe('ResourceCard', () => {
  it('marks its states', async () => {
    const { unmount } = renderWithBazis(
      <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections} />,
      new Backend().hold('GET', ITEM),
    );
    // the skeleton of the card is the loading state
    const loading = screen.getByTestId('state:loading');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    unmount();
    for (const [status, state] of [[404, 'not_found'], [403, 'forbidden'], [500, 'error']] as const) {
      const card = renderWithBazis(
        <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections} />,
        new Backend().on('GET', ITEM, errors(status), status),
      );
      expect(await screen.findByTestId(`state:${state}`)).toBeTruthy();
      card.unmount();
    }
  });

  it('gives a section of the product the item and its permission meta', async () => {
    // what the user may do on the item (`crud_actions` and `custom_actions` of the card),
    // without another request
    const server = backend({ crud_actions: ['view', 'change'], custom_actions: ['action_report'] });
    renderWithBazis(
      <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections}>
        {(item, meta) => (
          <span data-bz="field:mine">
            {`${String(item.attributes?.title)} ${permitted(meta, 'change') ? 'change' : 'view'}`}
            {` ${permitted(meta, 'action_report') ? 'report' : ''}${permitted(meta, 'action_archive') ? ' archive' : ''}`}
          </span>
        )}
      </ResourceCard>,
      server,
    );
    await screen.findByTestId('state:loaded');
    expect(screen.getByTestId('field:mine').textContent).toBe('Report change report');
    const reads = server.requests('GET').filter((it) => it.startsWith(`GET ${ITEM}?`));
    expect(reads).toEqual([`GET ${ITEM}?meta=crud_actions%2Ccustom_actions`]);
  });

  it('shows its sections and its content in tabs, the first one shown, every one mounted', async () => {
    const tabbed = [
      { id: 'main', title: 'Main', fields: ['title'] },
      { id: 'numbers', title: 'Numbers', fields: ['count'] },
    ];
    renderWithBazis(
      <ResourceCard
        path={ITEMS as never}
        id={ITEM_ID}
        sections={tabbed}
        tabs={[
          { id: 'details', title: 'Details' },
          { id: 'more', title: 'More', sections: ['numbers'], content: (item) => <span data-bz="list:parts">{item.id}</span> },
        ]}
      >
        <span data-bz="transit:start" />
      </ResourceCard>,
      backend({ crud_actions: ['view'] }),
    );
    await screen.findByTestId('state:loaded');
    const details = screen.getByTestId('tab:details');
    const more = screen.getByTestId('tab:more');
    expect([details.getAttribute('aria-selected'), more.getAttribute('aria-selected')]).toEqual(['true', 'false']);
    // a section that no tab names is in the first one; the others in theirs, hidden
    const panel = (tab: HTMLElement) => document.getElementById(tab.getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(panel(details).contains(screen.getByTestId('field:title'))).toBe(true);
    expect(panel(more).contains(screen.getByTestId('field:count'))).toBe(true);
    expect(panel(more).contains(screen.getByTestId('list:parts'))).toBe(true);
    expect(panel(more).getAttribute('data-state')).toBe('inactive');
    // the children above the tabs
    expect(panel(details).contains(screen.getByTestId('transit:start'))).toBe(false);
    fireEvent.mouseDown(more, { button: 0 });
    expect(more.getAttribute('aria-selected')).toBe('true');
    expect(panel(more).getAttribute('data-state')).toBe('active');
    expect(screen.getByTestId('list:parts').textContent).toBe(ITEM_ID);
  });

  it('shows its children under its heading and what comes after under its sections', async () => {
    renderWithBazis(
      <ResourceCard
        path={ITEMS as never}
        id={ITEM_ID}
        sections={sections}
        after={(item, meta) => <p>after {item.id} {meta === undefined ? '' : 'with its meta'}</p>}
      >
        <p>children</p>
      </ResourceCard>,
      backend({ crud_actions: ['view'] }),
    );
    const after = await screen.findByText(`after ${ITEM_ID} with its meta`);
    const field = screen.getByTestId('field:title');
    const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(screen.getByText('children'), field)).toBe(true);
    expect(follows(field, after)).toBe(true);
  });

  it('shows the fields of its sections', async () => {
    renderWithBazis(
      <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections} badge={() => <span>badge</span>} />,
      backend({ crud_actions: ['view'] }),
    );
    await screen.findByTestId('state:loaded');
    expect(screen.getByTestId('field:title').textContent).toBe('Report');
    expect(screen.getByTestId('field:count').textContent).toBe('3');
    expect(await screen.findByText('Title')).toBeTruthy();
    expect(screen.getByText('badge')).toBeTruthy();
    // the backend does not allow the change
    expect(screen.queryByTestId('action:edit')).toBeNull();
  });

  it('is headed by the name of its item, else by the values of its label fields, not by its id', async () => {
    const fields = runtimeSchema({
      count: { attribute: { type: 'integer', title: 'Count' } },
      year: { attribute: { type: 'integer', title: 'Year' } },
      done: { attribute: { type: 'boolean', title: 'Done' } },
    });
    const server = new Backend()
      .on('GET', `${ITEM}schema_retrieve/`, fields)
      .on('GET', ITEM, { data: resource(ITEM_ID, { count: 12000, year: 1877, done: true }), meta: {} });
    // the first two fields of the sections
    const { unmount } = renderWithBazis(
      <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={[{ id: 'main', fields: ['count', 'year', 'done'] }]} display={{ year: 'plain' }} />,
      server,
    );
    await screen.findByTestId('state:loaded');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('12,000 · 1877');
    expect(screen.getByTestId('field:year').textContent).toBe('1877');
    unmount();
    // the label fields of the entity that have a value
    const labelled = renderWithBazis(
      <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={[{ id: 'main', fields: ['count', 'year'] }]} label={['done', 'missing']} />,
      server,
    );
    await screen.findByTestId('state:loaded');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Yes');
    expect(screen.getByTestId('field:year').textContent).toBe('1877');
    labelled.unmount();
    // an empty label: the first two fields of the sections, never an empty heading
    renderWithBazis(
      <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={[{ id: 'main', fields: ['count', 'year'] }]} label={[]} />,
      server,
    );
    await screen.findByTestId('state:loaded');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('12,000 · 1877');
  });

  it('is in the language of the interface: the backend is asked in it, the values are formatted in it', async () => {
    const languages = testLanguages('ru', 'en');
    const server = backend({ crud_actions: ['view', 'change'] });
    renderWithBazis(<ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections} edit />, server, {
      language: languages,
    });
    await screen.findByTestId('state:loaded');
    expect(screen.getByTestId('action:edit').textContent).toBe('Изменить');
    expect(new Set(server.calls.map((call) => call.language))).toEqual(new Set(['ru']));
    // another language: the queries are read again in it (their texts are of the language)
    const count = server.calls.length;
    act(() => {
      languages.set('en');
    });
    await waitFor(() => {
      expect(server.calls.slice(count).filter((call) => call.language === 'en').length).toBeGreaterThan(0);
    });
    expect(screen.getByTestId('action:edit').textContent).toBe('Edit');
  });

  it('shows only the fields of the retrieve schema of the user, marks those the edit does not change', async () => {
    const backend = new Backend()
      // the field permissions of the user hide `secret`; the update has `count` read-only and
      // no `title`
      .on('GET', `${ITEM}schema_retrieve/`, schema)
      .on('GET', `${ITEM}schema_update/`, runtimeSchema({ count: { attribute: { type: 'integer', readOnly: true } }, done: { attribute: { type: 'boolean' } } }))
      .on('GET', ITEM, { data: resource(ITEM_ID, { title: 'Report', count: 3 }), meta: { crud_actions: ['view', 'change'] } });
    renderWithBazis(
      <ResourceCard
        path={ITEMS as never}
        id={ITEM_ID}
        edit
        sections={[
          { id: 'main', title: 'Main', fields: ['title', 'secret', 'count', 'done'] },
          { id: 'hidden', title: 'Hidden', fields: ['secret'] },
        ]}
      >
        {(item) => <p>children of {item.id}</p>}
      </ResourceCard>,
      backend,
    );
    await screen.findByTestId('state:loaded');
    expect(screen.queryByTestId('field:secret')).toBeNull();
    expect(screen.queryByTestId('field:done')).toBeNull();
    // a section without a field the user may see is left out
    expect(screen.queryByRole('region', { name: 'Hidden' })).toBeNull();
    expect(screen.getByText(`children of ${ITEM_ID}`)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText('(read-only)')).toHaveLength(2);
    });
    const term = (name: string) => screen.getByTestId(`field:${name}`).previousElementSibling?.textContent;
    expect(term('title')).toBe('Title(read-only)');
    expect(term('count')).toBe('Count(read-only)');
  });

  it('marks nothing read-only when the user may not change the item', async () => {
    const server = backend({ crud_actions: ['view'] });
    renderWithBazis(<ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections} edit />, server);
    await screen.findByTestId('state:loaded');
    expect(screen.queryByText('(read-only)')).toBeNull();
    expect(server.requests().some((it) => it.includes('schema_update'))).toBe(false);
  });

  /** The open form of the edit: the `<form>` with `action:submit`, as the scenarios find it. */
  function form(): HTMLElement {
    const element = screen.getByTestId('action:submit').closest('form');
    if (element === null) throw new Error('No open form');
    return element;
  }

  for (const forms of ['dialog', 'page'] as const) {
    it(`edits the item in a ${forms} when the backend allows it`, async () => {
      const onDelete = vi.fn();
      renderWithBazis(
        <Screen id="item-card" title="Item">
          <ResourceCard
            path={ITEMS as never}
            id={ITEM_ID}
            sections={sections}
            edit
            forms={forms}
            actions={[{ id: 'delete', label: 'Delete', onClick: onDelete, permission: 'delete' }]}
          />
        </Screen>,
        backend({ crud_actions: ['view', 'change'] }),
      );
      fireEvent.click(await screen.findByTestId('action:edit'));
      // the form of the update, with the fields of the sections
      await screen.findByTestId('action:submit');
      expect(within(form()).getByTestId('field:title').tagName).toBe('INPUT');
      expect(screen.queryByTestId('action:delete')).toBeNull();
      fireEvent.click(within(form()).getByTestId('action:cancel'));
      await waitFor(() => {
        expect(screen.queryByTestId('action:submit')).toBeNull();
      });
      expect(screen.getByTestId('field:title').tagName).toBe('DD');
    });
  }

  it('heads a screen without a title, its h1, and is under the title of another', async () => {
    const server = backend({ crud_actions: ['view'] });
    const { unmount } = renderWithBazis(
      <Screen id="item-card" parent={{ screen: 'item-list', label: 'Items', to: '/items' }}>
        <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections} />
      </Screen>,
      server,
    );
    await screen.findByTestId('state:loaded');
    // its sections one below
    expect(screen.getAllByRole('heading').map((it) => it.tagName)).toEqual(['H1', 'H2']);
    unmount();
    renderWithBazis(
      <Screen id="item-list" title="Items">
        <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections} />
      </Screen>,
      server,
    );
    await screen.findByTestId('state:loaded');
    expect(screen.getAllByRole('heading').map((it) => it.tagName)).toEqual(['H1', 'H2', 'H3']);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Items');
  });

  it('shows the edit as a page in place of the screen', async () => {
    renderWithBazis(
      <Screen id="item-card" title="Item">
        <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections} edit forms="page" />
      </Screen>,
      backend({ crud_actions: ['view', 'change'] }),
    );
    fireEvent.click(await screen.findByTestId('action:edit'));
    await screen.findByTestId('action:submit');
    // the screen keeps its mark, the form is in it, the content of the card is hidden
    expect(screen.getByTestId('screen:item-card').contains(form())).toBe(true);
    expect(screen.getByTestId('action:edit').closest('.hidden')).not.toBeNull();
  });
});

describe('RelatedList', () => {
  // the parts of an item: a resource whose relationship `item` references it
  const PARTS = '/api/test/part/';
  const partSchema = (list: boolean) =>
    runtimeSchema(
      { name: { attribute: { type: 'string', maxLength: 50, title: 'Name' } }, item: { relation: 'test.item', nullable: false } },
      { list, type: 'test.part' },
    );

  function parts(meta: object) {
    return new Backend()
      .on('GET', `${PARTS}schema_list/`, partSchema(true))
      .on('GET', `${PARTS}schema_create/`, partSchema(false))
      .on('GET', PARTS, listDocument([resource('p1', { name: 'Wheel' }, {}, 'test.part')], { meta }))
      .on('POST', PARTS, { data: resource('p2', { name: 'Seat' }, {}, 'test.part') }, 201);
  }

  it('lists the related items of the item and adds one with the relationship fixed', async () => {
    const server = parts({ for_create: true });
    const onSaved = vi.fn();
    renderWithBazis(
      <RelatedList
        path={PARTS as never}
        entity="part"
        relation="item"
        item={ITEM_ID}
        itemPath={ITEMS as never}
        columns={['name']}
        title="Parts"
        forms="dialog"
        add={{ id: 'add-part', label: 'Add a part', fields: ['name'], onSaved }}
      />,
      server,
    );
    const list = await screen.findByTestId('list:part');
    expect(await within(list).findByTestId('row:p1')).toBeTruthy();
    // the list of the related items of this item only
    expect(server.requests('GET').some((it) => decodeURIComponent(it).includes(`filter=item=${ITEM_ID}`))).toBe(true);

    fireEvent.click(screen.getByTestId('action:add-part'));
    const name = await screen.findByTestId('field:name');
    // the relationship is not chosen again
    expect(screen.queryByTestId('field:item')).toBeNull();
    fireEvent.change(name, { target: { value: 'Seat' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(server.calls.find((call) => call.method === 'POST')?.body).toEqual({
      data: {
        type: 'test.part',
        attributes: { name: 'Seat' },
        relationships: { item: { data: { type: 'test.item', id: ITEM_ID } } },
      },
    });
    // the form is closed
    expect(screen.queryByTestId('action:submit')).toBeNull();
  });

  it('adds nothing when the backend does not allow the create, or without add', async () => {
    const { unmount } = renderWithBazis(
      <RelatedList
        path={PARTS as never}
        entity="part"
        relation="item"
        item={ITEM_ID}
        itemPath={ITEMS as never}
        columns={['name']}
        add={{ id: 'add-part', label: 'Add a part' }}
      />,
      parts({ for_create: false }),
    );
    expect(await within(await screen.findByTestId('list:part')).findByTestId('row:p1')).toBeTruthy();
    expect(screen.queryByTestId('action:add-part')).toBeNull();
    unmount();
    renderWithBazis(
      <RelatedList path={PARTS as never} entity="part" relation="item" item={ITEM_ID} itemPath={ITEMS as never} columns={['name']} />,
      parts({ for_create: true }),
    );
    expect(await within(await screen.findByTestId('list:part')).findByTestId('row:p1')).toBeTruthy();
    expect(screen.queryByTestId('action:add-part')).toBeNull();
  });

  it('reads the item of the card again once an item is added, in the card or after it', async () => {
    // a part changes what the card shows of the item (a computed field, its transits); the
    // section reads the card by its query keys, wherever the screen places it
    for (const placement of ['children', 'after', 'outside'] as const) {
      const server = parts({ for_create: true })
        .on('GET', `${ITEM}schema_retrieve/`, schema)
        .on('GET', ITEM, { data: resource(ITEM_ID, { title: 'Report', count: 3 }), meta: { crud_actions: ['view'] } });
      const related = (
        <RelatedList
          path={PARTS as never}
          entity="part"
          relation="item"
          item={ITEM_ID}
          itemPath={ITEMS as never}
          columns={['name']}
          forms="dialog"
          add={{ id: 'add-part', label: 'Add a part', fields: ['name'] }}
        />
      );
      const { unmount } = renderWithBazis(
        placement === 'children' ? (
          <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections}>
            {related}
          </ResourceCard>
        ) : placement === 'after' ? (
          <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections} after={related} />
        ) : (
          <>
            <ResourceCard path={ITEMS as never} id={ITEM_ID} sections={sections} />
            {related}
          </>
        ),
        server,
      );
      expect(await within(await screen.findByTestId('list:part')).findByTestId('row:p1')).toBeTruthy();
      expect(await screen.findByTestId('field:count')).toBeTruthy();
      const reads = () => server.requests('GET').filter((it) => it.startsWith(`GET ${ITEM}?`)).length;
      expect(reads()).toBe(1);
      server.on('GET', ITEM, { data: resource(ITEM_ID, { title: 'Report', count: 4 }), meta: { crud_actions: ['view'] } });
      fireEvent.click(screen.getByTestId('action:add-part'));
      fireEvent.change(await screen.findByTestId('field:name'), { target: { value: 'Seat' } });
      fireEvent.click(screen.getByTestId('action:submit'));
      await waitFor(() => {
        expect(screen.getByTestId('field:count').textContent).toBe('4');
      });
      expect(reads()).toBe(2);
      unmount();
    }
  });

  it('shows the actions of its rows that the user may do', async () => {
    const remove = vi.fn();
    // the delete of the first part only
    const meta = { for_create: false, for_change: [], for_delete: ['p1'] };
    const rows = [resource('p1', { name: 'Wheel' }, {}, 'test.part'), resource('p2', { name: 'Seat' }, {}, 'test.part')];
    const server = new Backend()
      .on('GET', `${PARTS}schema_list/`, partSchema(true))
      .on('GET', PARTS, listDocument(rows, { meta }));
    renderWithBazis(
      <RelatedList
        path={PARTS as never}
        entity="part"
        relation="item"
        item={ITEM_ID}
        itemPath={ITEMS as never}
        columns={['name']}
        rowActions={[{ id: 'delete-part', label: 'Delete', onClick: remove, permission: 'delete' }]}
      />,
      server,
    );
    const list = await screen.findByTestId('list:part');
    const wheel = await within(list).findByTestId('row:p1');
    expect(within(within(list).getByTestId('row:p2')).queryByTestId('action:delete-part')).toBeNull();
    fireEvent.click(within(wheel).getByTestId('action:delete-part'));
    expect(remove).toHaveBeenCalledWith('p1');
  });
});
