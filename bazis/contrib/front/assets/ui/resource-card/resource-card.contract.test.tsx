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

// The contract of the card of an item: its states (`loading`, `forbidden`, `not_found`,
// `error`, `loaded`), `field:<name>` of its values with the titles of the retrieve schema,
// the actions the backend allows and the inline edit (`action:edit`, then the form). Keep it
// passing when the component is changed.

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
    expect(screen.getByTestId('state:loading')).toBeTruthy();
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

  it('edits the item in place when the backend allows it', async () => {
    const onDelete = vi.fn();
    renderWithBazis(
      <ResourceCard
        path={ITEMS as never}
        id={ITEM_ID}
        sections={sections}
        edit
        actions={[{ id: 'delete', label: 'Delete', onClick: onDelete, permission: 'delete' }]}
      />,
      backend({ crud_actions: ['view', 'change'] }),
    );
    fireEvent.click(await screen.findByTestId('action:edit'));
    // the form of the update, with the fields of the sections
    const title = await screen.findByTestId('field:title');
    expect(title.tagName).toBe('INPUT');
    expect(screen.queryByTestId('action:delete')).toBeNull();
    fireEvent.click(screen.getByTestId('action:cancel'));
    await waitFor(() => {
      expect(screen.getByTestId('field:title').tagName).toBe('DD');
    });
  });
});
