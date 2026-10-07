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
// retrieve schema, the actions the backend allows and the edit (`action:edit`, then the
// form, in a dialog or as a page). Keep it passing when the component is changed.

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Screen } from '@/bazis/ui/app-shell';
import { ResourceCard } from '@/bazis/ui/resource-card';
import { Backend, errors, ITEM_ID, ITEMS, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

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
