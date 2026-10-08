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

// The contract of the result of a request run in the background: `async:<status>`
// (`pending`, `processing`, `completed`, `failed`) read until the task is done, the response
// rendered by the product (of a replayed request, the body of its endpoint), an HTTP error of
// the replayed request as a failure with its message, a request run at once as completed,
// and the states of the reading (`state:not_found`). Keep it passing when the component is
// changed.

import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AsyncResult } from '@/bazis/ui/async-result';
import { Backend, errors, renderWithBazis } from '@/bazis/ui/testing';

/** The result path of the tests, of no product. */
const RESULTS = '/api/test/result/{task_id}/';
const TASK = '0b6f9a1e-0000-4000-8000-000000000002';
const READ = `/api/test/result/${TASK}/?full_response=true`;
const QUEUED = { status: 'queued', taskId: TASK } as const;
const BODY = { data: { id: '7', type: 'test.item', attributes: { name: 'Later' } } };

function replayed(status: number, response: unknown) {
  return { task_id: TASK, endpoint: '/api/test/item/7/', status, headers: [], response };
}

function show(result: unknown, status = 200, props: { onDone?: () => void } = {}) {
  const backend = new Backend().on('GET', READ, result, status);
  renderWithBazis(
    <AsyncResult start={QUEUED} path={RESULTS} {...props}>
      {(response) => <p>{JSON.stringify(response)}</p>}
    </AsyncResult>,
    backend,
  );
  return backend;
}

describe('AsyncResult', () => {
  it('shows a queued task', async () => {
    const backend = show({ status: 'pending', channel_name: 'user_ws::1', response: null });
    await waitFor(() => {
      expect(backend.requests('GET')).toEqual([`GET ${READ}`]);
    });
    expect(screen.getByTestId('async:pending').getAttribute('aria-busy')).toBe('true');
  });

  it('shows a task that runs', async () => {
    show({ status: 'processing', channel_name: 'user_ws::1', response: null });
    expect(await screen.findByTestId('async:processing')).toBeTruthy();
  });

  it('renders the response of the endpoint of a replayed request, and reports it once', async () => {
    const onDone = vi.fn();
    show({ status: 'completed', channel_name: 'user_ws::1', response: replayed(200, BODY) }, 200, { onDone });
    const section = await screen.findByTestId('async:completed');
    expect(section.textContent).toContain('"name":"Later"');
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledOnce();
    });
  });

  it('shows an HTTP error of the replayed request as a failure', async () => {
    show({
      status: 'completed',
      channel_name: 'user_ws::1',
      response: replayed(403, { errors: [{ status: 403, detail: 'Permission denied' }] }),
    });
    const section = await screen.findByTestId('async:failed');
    expect(section.textContent).toContain('Permission denied');
    expect(section.textContent).not.toContain('errors');
  });

  it('shows a failed task', async () => {
    show({ status: 'failed', channel_name: 'user_ws::1', response: { error: 'The request failed' } });
    expect((await screen.findByTestId('async:failed')).textContent).toContain('The request failed');
  });

  it('shows a request that the backend ran at once', () => {
    const backend = new Backend();
    renderWithBazis(
      <AsyncResult start={{ status: 'done', response: BODY }} path={RESULTS}>
        {(response) => <p>{JSON.stringify(response)}</p>}
      </AsyncResult>,
      backend,
    );
    expect(screen.getByTestId('async:completed').textContent).toContain('"name":"Later"');
    expect(backend.calls).toEqual([]);
  });

  it('shows an unknown task as not found', async () => {
    show(errors(404), 404);
    expect(await screen.findByTestId('state:not_found')).toBeTruthy();
  });

  it('needs the route of the results', () => {
    renderWithBazis(<AsyncResult start={QUEUED} path={null} />, new Backend());
    expect(screen.getByTestId('state:error').textContent).toContain('bazis-async-background');
  });
});
