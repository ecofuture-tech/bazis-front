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
// `field:<name>` and `error:<name>` of its fields (a to-many relationship among them, sent
// with all its items), the read-only fields, `action:submit` and `action:cancel`, no submit
// while a file uploads. Keep it passing when the component is changed.

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as Contract from '@/bazis/generated/contract';

import { Screen } from '@/bazis/ui/app-shell';
import { FilesProvider, PointsProvider, type FileControlProps } from '@/bazis/ui/resource';
import { FormSurface, ResourceForm } from '@/bazis/ui/resource-form';
import { Backend, errors, ITEM_ID, ITEMS, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

// the contract of the product with the resource of the tests, whose `children` is a reverse
// relationship (the foreign key on the related model) and whose `plan` is a field that the
// backend sets itself (not in the create schema)
vi.mock('@/bazis/generated/contract', async (importOriginal) => {
  const contract = await importOriginal<typeof Contract>();
  return {
    ...contract,
    RESOURCES: {
      ...contract.RESOURCES,
      'test.item': {
        path: '/api/test/item/',
        fields: { children: { relation: 'test.unknown', many: true, reverse: true }, plan: { title: 'Plan of the item' } },
        search: [],
      },
    },
  };
});

const schema = runtimeSchema({
  title: { attribute: { type: 'string', maxLength: 100, title: 'Title' }, required: true },
  code: { attribute: { type: 'string', maxLength: 10, readOnly: true } },
  owner: { relation: 'test.unknown' },
});

describe('ResourceForm', () => {
  it('is loading until the schema is loaded', () => {
    renderWithBazis(<ResourceForm path={ITEMS as never} />, new Backend().hold('GET', `${ITEMS}schema_create/`));
    const loading = screen.getByTestId('state:loading');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.querySelector('[data-slot="skeleton"]')).not.toBeNull();
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

  it('sends the items of a to-many relationship with the other fields', async () => {
    // a resource without a route in the contract: the ids in a text input (else the picker of
    // its items, `RelationListPicker`)
    const members = runtimeSchema({ members: { relation: 'test.unknown', many: true, title: 'Members' } });
    const backend = new Backend()
      .on('GET', `${ITEMS}${ITEM_ID}/schema_update/`, members)
      .on('GET', `${ITEMS}${ITEM_ID}/`, {
        data: { ...resource(ITEM_ID), relationships: { members: { data: [{ id: 'x1', type: 'test.unknown' }] } } },
      })
      .on('PATCH', `${ITEMS}${ITEM_ID}/`, { data: resource(ITEM_ID) });
    const onSaved = vi.fn();
    renderWithBazis(<ResourceForm path={ITEMS as never} id={ITEM_ID} onSaved={onSaved} />, backend);

    const input = await screen.findByTestId<HTMLInputElement>('field:members');
    expect(input.value).toBe('x1');
    fireEvent.change(input, { target: { value: 'x1, x2' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(backend.calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      data: {
        type: 'test.item',
        id: ITEM_ID,
        attributes: {},
        relationships: {
          members: { data: [{ type: 'test.unknown', id: 'x1' }, { type: 'test.unknown', id: 'x2' }] },
        },
      },
    });
  });

  it('leaves out a reverse relationship unless its fields name it', async () => {
    const parent = runtimeSchema({
      title: { attribute: { type: 'string', maxLength: 100 } },
      children: { relation: 'test.unknown', many: true },
      members: { relation: 'test.unknown', many: true },
    });
    const backend = new Backend().on('GET', `${ITEMS}schema_create/`, parent);
    const { unmount } = renderWithBazis(<ResourceForm path={ITEMS as never} />, backend);
    expect(await screen.findByTestId('field:members')).toBeTruthy();
    expect(screen.getByTestId('field:title')).toBeTruthy();
    // the core deletes the unlinked items of a reverse foreign key: never in a default form
    expect(screen.queryByTestId('field:children')).toBeNull();
    unmount();

    renderWithBazis(<ResourceForm path={ITEMS as never} fields={['title', 'children']} />, backend);
    expect(await screen.findByTestId('field:children')).toBeTruthy();
  });

  it('edits a URL field of the core and clears it to the empty string', async () => {
    // the schema of a `URLField(blank=True)` of bazis 2.16: the URL or the empty string
    const linked = runtimeSchema({
      site: {
        attribute: {
          anyOf: [{ type: 'string', format: 'uri', minLength: 1, maxLength: 200 }, { type: 'string', maxLength: 0 }],
          title: 'Site',
        },
      },
    });
    const backend = new Backend()
      .on('GET', `${ITEMS}${ITEM_ID}/schema_update/`, linked)
      .on('GET', `${ITEMS}${ITEM_ID}/`, { data: resource(ITEM_ID, { site: 'https://example.com/' }) })
      .on('PATCH', `${ITEMS}${ITEM_ID}/`, { data: resource(ITEM_ID, { site: '' }) });
    const onSaved = vi.fn();
    renderWithBazis(<ResourceForm path={ITEMS as never} id={ITEM_ID} onSaved={onSaved} />, backend);

    const site = await screen.findByTestId<HTMLInputElement>('field:site');
    expect([site.type, site.value]).toEqual(['url', 'https://example.com/']);
    fireEvent.change(site, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(backend.calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({
      data: { attributes: { site: '' } },
    });
  });

  it('edits a point field of its route set as coordinates and sends GeoJSON', async () => {
    const located = runtimeSchema({
      location: { attribute: { anyOf: [{ type: 'object' }, { type: 'null' }], nullable: true, title: 'Location' } },
    });
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_create/`, located)
      .on('POST', ITEMS, { data: resource(ITEM_ID) }, 201);
    renderWithBazis(
      <PointsProvider control={null} fields={{ [ITEMS]: ['location'] }}>
        <ResourceForm path={ITEMS as never} />
      </PointsProvider>,
      backend,
    );
    fireEvent.change(await screen.findByTestId('field:location'), { target: { value: '55.75, 37.62' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(backend.requests('POST')).toEqual([`POST ${ITEMS}`]);
    });
    expect(backend.calls.find((call) => call.method === 'POST')?.body).toEqual({
      data: { type: 'test.item', attributes: { location: { type: 'Point', coordinates: [37.62, 55.75] } }, relationships: {} },
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

  it('shows the validation errors of Pydantic in the language of the interface', async () => {
    const backend = new Backend().on('GET', `${ITEMS}schema_create/`, schema).on(
      'POST',
      ITEMS,
      {
        errors: [
          { status: 422, code: 'ERR_VALIDATE', title: 'missing', detail: 'Field required', source: { pointer: '/data/attributes/title' } },
        ],
      },
      422,
    );
    renderWithBazis(<ResourceForm path={ITEMS as never} />, backend);

    fireEvent.click(await screen.findByTestId('action:submit'));
    expect(await screen.findByTestId('state:invalid')).toBeTruthy();
    // the text of `validation.required`, not the English of Pydantic
    expect(screen.getByTestId('error:title').textContent).not.toMatch(/^(Field required|validation\.required|)$/);
  });

  it('shows the errors of the item at its fields, the others in the form', async () => {
    // the invariants of the item (`validate_item` of the core: 422 `ERR_ITEM_INVALID`): of a
    // field, of the item as a whole, of an included item
    const invalid = (detail: string, pointer: string) => ({ status: 422, code: 'ERR_ITEM_INVALID', detail, source: { pointer } });
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_create/`, schema)
      .on(
        'POST',
        ITEMS,
        {
          errors: [
            invalid('Taken', '/data/attributes/title'),
            invalid('Overlaps another item', '/data'),
            invalid('Ends before it starts', '/included/0/attributes/end'),
          ],
        },
        422,
      );
    renderWithBazis(<ResourceForm path={ITEMS as never} fields={['title']} />, backend);

    fireEvent.click(await screen.findByTestId('action:submit'));
    const state = await screen.findByTestId('state:invalid');
    expect(screen.getByTestId('error:title').textContent).toBe('Taken');
    expect(screen.getByTestId('field:title').getAttribute('aria-invalid')).toBe('true');
    expect(state.textContent).toContain('Overlaps another item');
    expect(state.textContent).toContain('Ends before it starts');
    expect(state.textContent).not.toContain('Taken');
  });

  it('names the fields of the errors that the form does not show by their titles', async () => {
    const invalid = (detail: string, pointer: string) => ({ status: 422, code: 'ERR_ITEM_INVALID', detail, source: { pointer } });
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_create/`, schema)
      .on(
        'POST',
        ITEMS,
        {
          errors: [
            // a field of the schema not in the form, a field of the contract only, a field of neither
            invalid('Not yours', '/data/relationships/owner'),
            invalid('No plan is active', '/data/relationships/plan'),
            invalid('Too late', '/data/attributes/starts_on'),
          ],
        },
        422,
      );
    renderWithBazis(<ResourceForm path={ITEMS as never} fields={['title']} />, backend);

    fireEvent.click(await screen.findByTestId('action:submit'));
    expect((await screen.findByTestId('state:invalid')).textContent).toBe('Owner: Not yours Plan of the item: No plan is active Starts on: Too late');
  });

  it('shows an error of the item alone in the form', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_create/`, schema)
      .on('POST', ITEMS, { errors: [{ status: 422, code: 'ERR_ITEM_INVALID', detail: 'Overlaps another item', source: { pointer: '/data' } }] }, 422);
    renderWithBazis(<ResourceForm path={ITEMS as never} fields={['title']} />, backend);

    fireEvent.click(await screen.findByTestId('action:submit'));
    expect((await screen.findByTestId('state:invalid')).textContent).toBe('Overlaps another item');
    expect(screen.queryByTestId('error:title')).toBeNull();
  });

  it('creates an item with fixed values: hidden, or read-only when the fields name them', async () => {
    // an item added from the card of its parent: the screen fixes the relationship
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_create/`, schema)
      .on('POST', ITEMS, { data: resource(ITEM_ID, { title: 'Report' }) }, 201);
    const onSaved = vi.fn();
    const { unmount } = renderWithBazis(
      <ResourceForm path={ITEMS as never} fixed={{ owner: 'u1' }} onSaved={onSaved} />,
      backend,
    );
    fireEvent.change(await screen.findByTestId('field:title'), { target: { value: 'Report' } });
    // every field of the schema but the fixed one
    expect(screen.queryByTestId('field:owner')).toBeNull();
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(backend.calls.find((call) => call.method === 'POST')?.body).toEqual({
      data: {
        type: 'test.item',
        attributes: { title: 'Report' },
        relationships: { owner: { data: { type: 'test.unknown', id: 'u1' } } },
      },
    });
    unmount();

    renderWithBazis(<ResourceForm path={ITEMS as never} fields={['owner', 'title']} fixed={{ owner: 'u1' }} />, backend);
    const owner = await screen.findByTestId<HTMLInputElement>('field:owner');
    // the picker of the relationship, with the fixed item, that the user cannot change
    expect(owner.value).toBe('u1');
    expect(owner.readOnly).toBe(true);
    expect(owner.disabled).toBe(true);
  });

  it('updates an item: read-only fields, cancel', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}${ITEM_ID}/schema_update/`, schema)
      .on('GET', `${ITEMS}${ITEM_ID}/`, { data: resource(ITEM_ID, { title: 'Report', code: 'R1' }) });
    const onCancel = vi.fn();
    // `secret`: a field that the update schema of the item does not have (the field
    // permissions of the user hide it) is left out
    renderWithBazis(
      <ResourceForm path={ITEMS as never} id={ITEM_ID} fields={['title', 'secret', 'code']} onCancel={onCancel} />,
      backend,
    );

    const code = await screen.findByTestId<HTMLInputElement>('field:code');
    expect(code.value).toBe('R1');
    expect(code.hasAttribute('readonly')).toBe(true);
    expect(screen.queryByTestId('field:secret')).toBeNull();
    expect(screen.getByTestId<HTMLInputElement>('field:title').value).toBe('Report');
    fireEvent.click(screen.getByTestId('action:cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('ResourceForm with a file', () => {
  /** A control whose file uploads until it is told: the buttons start and end the upload. */
  function Control({ control, onBusy, onChange }: FileControlProps) {
    return (
      <span data-bz={control['data-bz']}>
        <button
          type="button"
          onClick={() => {
            onBusy(true);
          }}
        >
          upload
        </button>
        <button
          type="button"
          onClick={() => {
            onChange('9');
            onBusy(false);
          }}
        >
          uploaded
        </button>
      </span>
    );
  }

  it('waits for the upload of a file, then sends its relationship', async () => {
    const backend = new Backend()
      .on('GET', `${ITEMS}schema_create/`, runtimeSchema({ attachment: { relation: 'test.file' } }))
      .on('POST', ITEMS, { data: resource(ITEM_ID) }, 201);
    const onSaved = vi.fn();
    renderWithBazis(
      <FilesProvider control={Control} resources={['test.file']}>
        <ResourceForm path={ITEMS as never} onSaved={onSaved} />
      </FilesProvider>,
      backend,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'upload' }));
    const submit = screen.getByTestId('action:submit');
    expect(submit).toHaveProperty('disabled', true);
    expect(screen.getByTestId('state:loaded').getAttribute('aria-busy')).toBe('true');
    fireEvent.submit(screen.getByTestId('state:loaded'));
    expect(backend.requests('POST')).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'uploaded' }));
    expect(submit).toHaveProperty('disabled', false);
    fireEvent.click(submit);
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(backend.calls.find((call) => call.method === 'POST')?.body).toEqual({
      data: { type: 'test.item', attributes: {}, relationships: { attachment: { data: { type: 'test.file', id: '9' } } } },
    });
  });
});

describe('FormSurface', () => {
  for (const mode of ['dialog', 'page'] as const) {
    it(`shows a form in a ${mode} and closes it`, async () => {
      const onClose = vi.fn();
      const backend = new Backend().on('GET', `${ITEMS}schema_create/`, schema);
      renderWithBazis(
        <Screen id="item-list" title="Items">
          <p>the list</p>
          <FormSurface mode={mode} open title="New item" onClose={onClose}>
            <ResourceForm path={ITEMS as never} onCancel={onClose} />
          </FormSurface>
        </Screen>,
        backend,
      );
      const submit = await screen.findByTestId('action:submit');
      expect(screen.getByText('New item')).toBeTruthy();
      if (mode === 'page') {
        // in place of the content of the screen, inside its mark
        expect(screen.getByTestId('screen:item-list').contains(submit)).toBe(true);
        expect(screen.getByText('the list').closest('.hidden')).not.toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      } else {
        expect(screen.getByRole('dialog').contains(submit)).toBe(true);
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      }
      expect(onClose).toHaveBeenCalled();
    });
  }
});
