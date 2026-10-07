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

// The contract of the form of a resource: its states (`loading`, `forbidden`, `invalid`),
// `field:<name>` and `error:<name>` of its fields, the read-only fields, `action:submit` and
// `action:cancel`. Keep it passing when the component is changed.

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ResourceForm } from '@/bazis/ui/resource-form';
import { Backend, errors, ITEM_ID, ITEMS, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

const schema = runtimeSchema({
  title: { attribute: { type: 'string', maxLength: 100, title: 'Title' }, required: true },
  code: { attribute: { type: 'string', maxLength: 10, readOnly: true } },
  owner: { relation: 'test.unknown' },
});

describe('ResourceForm', () => {
  it('is loading until the schema is loaded', () => {
    renderWithBazis(<ResourceForm path={ITEMS as never} />, new Backend().hold('GET', `${ITEMS}schema_create/`));
    expect(screen.getByTestId('state:loading')).toBeTruthy();
  });

  it('is forbidden when the backend refuses the schema', async () => {
    const backend = new Backend().on('GET', `${ITEMS}schema_create/`, errors(403), 403);
    renderWithBazis(<ResourceForm path={ITEMS as never} />, backend);
    expect(await screen.findByTestId('state:forbidden')).toBeTruthy();
  });

  it('creates an item with the changed fields', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_create/`, schema)
      .on('POST', ITEMS, { data: resource(ITEM_ID, { title: 'Report' }) }, 201);
    const onSaved = vi.fn();
    renderWithBazis(<ResourceForm path={ITEMS as never} fields={['title', 'owner']} onSaved={onSaved} />, backend);

    fireEvent.change(await screen.findByTestId('field:title'), { target: { value: 'Report' } });
    expect(screen.queryByTestId('field:code')).toBeNull();
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({ data: expect.objectContaining({ id: ITEM_ID }) as unknown });
    });
    expect(backend.calls.find((call) => call.method === 'POST')?.body).toEqual({
      data: { type: 'test.item', attributes: { title: 'Report' }, relationships: {} },
    });
  });

  it('shows the errors of a 422 by field', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_create/`, schema)
      .on('POST', ITEMS, errors(422, { title: 'Field required' }), 422);
    renderWithBazis(<ResourceForm path={ITEMS as never} />, backend);

    fireEvent.click(await screen.findByTestId('action:submit'));
    expect(await screen.findByTestId('state:invalid')).toBeTruthy();
    expect(screen.getByTestId('error:title').textContent).toBe('Field required');
    expect(screen.getByTestId('field:title').getAttribute('aria-invalid')).toBe('true');
  });

  it('updates an item: read-only fields, cancel', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}${ITEM_ID}/schema_update/`, schema)
      .on('GET', `${ITEMS}${ITEM_ID}/`, { data: resource(ITEM_ID, { title: 'Report', code: 'R1' }) });
    const onCancel = vi.fn();
    renderWithBazis(<ResourceForm path={ITEMS as never} id={ITEM_ID} onCancel={onCancel} />, backend);

    const code = await screen.findByTestId<HTMLInputElement>('field:code');
    expect(code.value).toBe('R1');
    expect(code.hasAttribute('readonly')).toBe(true);
    expect(screen.getByTestId<HTMLInputElement>('field:title').value).toBe('Report');
    fireEvent.click(screen.getByTestId('action:cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
