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
// disabled when a validator restricts it, the dialog of a typed payload (`field:<name>`,
// `error:<name>`, `action:submit`), `state:loading` and `state:error`. Keep it passing when
// the component is changed.

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

describe('TransitBar', () => {
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
