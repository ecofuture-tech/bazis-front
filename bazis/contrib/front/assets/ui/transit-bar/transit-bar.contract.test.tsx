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

// The contract of the transits of an item: `transit:<id>` of each transit the user may run,
// in the order of the specs (the first the main button), disabled when a validator restricts
// it, the dialog of a typed payload (`field:<name>`, `error:<name>`, `action:submit`), that of
// the confirmation of a transit the specs confirm (`action:confirm-<id>`), `state:loading`
// and `state:error`. Keep it passing when the component is changed.

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ITEM_META, useAnyItem } from '@/bazis/ui/resource';
import { Backend, errors, ITEM_ID, ITEMS, renderWithBazis, resource } from '@/bazis/ui/testing';
import { TransitBar } from '@/bazis/ui/transit-bar';

const ITEM = `${ITEMS}${ITEM_ID}/`;

/** A state action of bazis-statusy: the transit, the schema of its payload, its restricts. */
function action(transit: string, payload: unknown, restricts: unknown = null) {
  return {
    code: 'ACTION_TRANSIT',
    endpoint: {
      url: `${ITEM}transit/`,
      method: 'POST',
      body: {
        type: 'object',
        required: ['payload'],
        properties: { transit: { type: 'string', default: transit }, payload },
      },
    },
    restricts,
    resource: { type: 'test.item', id: ITEM_ID },
  };
}

const NO_PAYLOAD = { anyOf: [{ type: 'object' }, { type: 'null' }] };
const REPORT = { type: 'object', required: ['report'], properties: { report: { type: 'string', title: 'Report' } } };

function backend() {
  return new Backend().on('GET', ITEM, {
    data: resource(ITEM_ID),
    meta: {
      state_actions: [
        action('start', NO_PAYLOAD),
        action('finish', REPORT),
        action('cancel', NO_PAYLOAD, [{ title: 'Paid', code: 'ERR', detail: 'The task is paid', meta: null }]),
      ],
    },
  });
}

/** The card of the item, as `ResourceCard` reads it. */
function Card() {
  const item = useAnyItem(ITEMS, ITEM_ID, { meta: ITEM_META });
  return item.data ? <p data-bz="card">{item.data.data.id}</p> : null;
}

describe('TransitBar', () => {
  it('reads the transits with the retrieve of the card of the item: one request', async () => {
    const server = backend();
    renderWithBazis(
      <>
        <Card />
        <TransitBar path={ITEMS as never} id={ITEM_ID} />
      </>,
      server,
    );
    expect(await screen.findByTestId('transit:start')).toBeTruthy();
    expect(await screen.findByTestId('card')).toBeTruthy();
    expect(server.requests('GET').map((it) => decodeURIComponent(it))).toEqual([
      `GET ${ITEM}?meta=${ITEM_META.join(',')}`,
    ]);
    // the dialog of a payload asks for it by the transit that the card read: no other request
    fireEvent.click(screen.getByTestId('transit:finish'));
    expect(await screen.findByTestId('field:report')).toBeTruthy();
    expect(server.requests('GET').map((it) => decodeURIComponent(it))).toEqual([`GET ${ITEM}?meta=${ITEM_META.join(',')}`]);
  });

  it('is loading, then marks the transits', async () => {
    const { unmount } = renderWithBazis(<TransitBar path={ITEMS as never} id={ITEM_ID} />, new Backend().hold('GET', ITEM));
    expect(screen.getByTestId('state:loading')).toBeTruthy();
    unmount();

    renderWithBazis(<TransitBar path={ITEMS as never} id={ITEM_ID} />, backend());
    expect(await screen.findByTestId('transit:start')).toBeTruthy();
    expect(screen.getByTestId('transit:finish')).toBeTruthy();
    expect(screen.getByTestId<HTMLButtonElement>('transit:cancel').disabled).toBe(true);
    expect(screen.getByText('The task is paid')).toBeTruthy();
  });

  it('runs a transit without a payload', async () => {
    const server = backend().on('POST', `${ITEM}transit/`, { data: resource(ITEM_ID) });
    const onDone = vi.fn();
    renderWithBazis(<TransitBar path={ITEMS as never} id={ITEM_ID} onDone={onDone} />, server);
    fireEvent.click(await screen.findByTestId('transit:start'));
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledOnce();
    });
    expect(server.calls.find((call) => call.method === 'POST')?.body).toEqual({ transit: 'start' });
  });

  it('shows the transits in the order of the specs, the first the main button, the others after them', async () => {
    renderWithBazis(<TransitBar path={ITEMS as never} id={ITEM_ID} transits={[{ id: 'finish' }, { id: 'start' }]} />, backend());
    await screen.findByTestId('transit:start');
    const ids = screen.getAllByRole('button').map((it) => it.getAttribute('data-bz'));
    expect(ids).toEqual(['transit:finish', 'transit:start', 'transit:cancel']);
    // the main button is filled, the others outlined
    expect(screen.getByTestId('transit:finish').getAttribute('data-variant')).toBe('default');
    expect(screen.getByTestId('transit:start').getAttribute('data-variant')).toBe('outline');
  });

  it('asks to confirm a transit that the specs confirm, and runs it once confirmed', async () => {
    const server = backend().on('POST', `${ITEM}transit/`, { data: resource(ITEM_ID) });
    const onDone = vi.fn();
    renderWithBazis(
      <TransitBar path={ITEMS as never} id={ITEM_ID} transits={[{ id: 'start', confirm: true }]} onDone={onDone} />,
      server,
    );
    fireEvent.click(await screen.findByTestId('transit:start'));
    // cancelled: nothing runs
    fireEvent.click(await screen.findByTestId('action:cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('action:confirm-start')).toBeNull();
    });
    expect(server.calls.some((call) => call.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByTestId('transit:start'));
    fireEvent.click(await screen.findByTestId('action:confirm-start'));
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledOnce();
    });
    expect(server.calls.find((call) => call.method === 'POST')?.body).toEqual({ transit: 'start' });
  });

  it('asks for the payload and shows its errors', async () => {
    const server = backend().on(
      'POST',
      `${ITEM}transit/`,
      { errors: [{ status: 422, detail: 'Field required', source: { pointer: '/payload/report' } }] },
      422,
    );
    renderWithBazis(<TransitBar path={ITEMS as never} id={ITEM_ID} />, server);
    fireEvent.click(await screen.findByTestId('transit:finish'));
    fireEvent.change(await screen.findByTestId('field:report'), { target: { value: 'Done' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    expect((await screen.findByTestId('error:report')).textContent).toBe('Field required');
    expect(server.calls.find((call) => call.method === 'POST')?.body).toEqual({
      transit: 'finish',
      payload: { report: 'Done' },
    });
  });

  it('asks for a decimal of the payload on one line and sends its digits with a point', async () => {
    // `Decimal` of Pydantic (`gt=0`): a number or a string
    const payload = {
      type: 'object',
      required: ['price'],
      properties: { price: { anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'string' }], title: 'Price' } },
    };
    const server = new Backend()
      .on('GET', ITEM, { data: resource(ITEM_ID), meta: { state_actions: [action('finish', payload)] } })
      .on('POST', `${ITEM}transit/`, { data: resource(ITEM_ID) });
    renderWithBazis(<TransitBar path={ITEMS as never} id={ITEM_ID} />, server);
    fireEvent.click(await screen.findByTestId('transit:finish'));
    const price = await screen.findByTestId<HTMLInputElement>('field:price');
    expect([price.tagName, price.inputMode]).toEqual(['INPUT', 'decimal']);
    fireEvent.change(price, { target: { value: '2,5' } });
    fireEvent.click(screen.getByTestId('action:submit'));
    await waitFor(() => {
      expect(server.calls.find((call) => call.method === 'POST')?.body).toEqual({ transit: 'finish', payload: { price: '2.5' } });
    });
  });

  it('labels a field of the payload with the title of its property, else its name', async () => {
    // the runtime schema of the payload (`state_actions`), in the language of the request
    const payload = { type: 'object', properties: { report: { type: 'string', title: 'Report' }, note: { type: 'string' } } };
    const server = new Backend().on('GET', ITEM, { data: resource(ITEM_ID), meta: { state_actions: [action('finish', payload)] } });
    renderWithBazis(<TransitBar path={ITEMS as never} id={ITEM_ID} />, server);
    fireEvent.click(await screen.findByTestId('transit:finish'));
    expect((await screen.findByLabelText('Report')).getAttribute('data-bz')).toBe('field:report');
    expect(screen.getByLabelText('note').getAttribute('data-bz')).toBe('field:note');
  });

  it('shows the errors that are not of a field of the payload with those of the fields', async () => {
    const server = backend().on(
      'POST',
      `${ITEM}transit/`,
      {
        errors: [
          { status: 422, detail: 'Field required', source: { pointer: '/payload/report' } },
          { status: 422, detail: 'The task has no assignee', code: 'ERR_TRANSIT' },
          { status: 422, detail: 'Unknown', source: { pointer: '/payload/extra' } },
        ],
      },
      422,
    );
    renderWithBazis(<TransitBar path={ITEMS as never} id={ITEM_ID} />, server);
    fireEvent.click(await screen.findByTestId('transit:finish'));
    fireEvent.click(await screen.findByTestId('action:submit'));
    expect((await screen.findByTestId('error:report')).textContent).toBe('Field required');
    const state = screen.getByTestId('state:invalid');
    expect(state.textContent).toContain('The task has no assignee');
    expect(state.textContent).toContain('extra: Unknown');
  });

  it('shows the error of a transit', async () => {
    const server = backend().on('POST', `${ITEM}transit/`, errors(403), 403);
    renderWithBazis(<TransitBar path={ITEMS as never} id={ITEM_ID} />, server);
    fireEvent.click(await screen.findByTestId('transit:start'));
    expect(await screen.findByTestId('state:forbidden')).toBeTruthy();
  });
});
