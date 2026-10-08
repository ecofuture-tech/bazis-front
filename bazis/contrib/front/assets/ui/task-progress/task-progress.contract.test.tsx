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

// The contract of the progress of a task of bazis-bg: `bg:<state>` (`waiting`, `running`,
// `success`, `error`, `interrupted`), the phase that runs with a progress bar for each
// counter, what the product renders of a task that succeeded, `onDone` once, and the states
// of the reading (`state:loading`, `state:not_found`). Keep it passing when the component is
// changed.

import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TaskProgress } from '@/bazis/ui/task-progress';
import { Backend, errors, ITEMS, ITEM_ID, renderWithBazis, resource } from '@/bazis/ui/testing';

const TASK = `${ITEMS}${ITEM_ID}/`;

function task(attributes: Readonly<Record<string, unknown>>) {
  return {
    data: resource(
      ITEM_ID,
      {
        name: 'Count the items',
        state: 'waiting',
        phase: 'waiting for start',
        expected: null,
        performed: null,
        result: null,
        error: null,
        interrupt: false,
        ...attributes,
      },
      {},
      'bg.task',
    ),
  };
}

function show(document: unknown, props: Partial<Parameters<typeof TaskProgress>[0]> = {}, status = 200) {
  const backend = new Backend().on('GET', TASK, document, status);
  renderWithBazis(<TaskProgress id={ITEM_ID} path={ITEMS} {...props} />, backend);
  return backend;
}

describe('TaskProgress', () => {
  it('shows a task that waits', async () => {
    show(task({}));
    const section = await screen.findByTestId('bg:waiting');
    expect(section.textContent).toContain('Count the items');
    expect(section.textContent).toContain('Waiting');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows the phase that runs with its progress', async () => {
    show(task({ state: 'running', phase: 'Count', expected: 4, performed: 1 }));
    const section = await screen.findByTestId('bg:running');
    expect(section.textContent).toContain('Count');
    const bar = screen.getByRole('progressbar', { name: 'Progress' });
    expect(bar.getAttribute('aria-valuenow')).toBe('25');
    expect(section.textContent).toContain('1 / 4');
  });

  it('shows a bar for each counter, without a maximum when none is expected', async () => {
    show(task({ state: 'running', phase: 'Import', expected: { rows: 10 }, performed: { rows: 5, files: 2 } }));
    await screen.findByTestId('bg:running');
    expect(screen.getByRole('progressbar', { name: 'Progress of rows' }).getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByRole('progressbar', { name: 'Progress of files' }).getAttribute('aria-valuenow')).toBeNull();
  });

  it('renders the result of a task that succeeded, and reports it once', async () => {
    const onDone = vi.fn();
    show(task({ state: 'done', phase: 'completed', result: { count: 3 } }), {
      onDone,
      children: (done) => <p>{JSON.stringify(done.result)}</p>,
    });
    const section = await screen.findByTestId('bg:success');
    expect(section.textContent).toContain('{"count":3}');
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledOnce();
    });
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({ outcome: 'success', result: { count: 3 } });
  });

  it('shows a failure without its traceback, and an interruption', async () => {
    show(task({ state: 'done', phase: 'error', error: 'Traceback (most recent call last)' }), {
      children: () => <p>result</p>,
    });
    const section = await screen.findByTestId('bg:error');
    expect(section.textContent).toContain('Failed');
    expect(section.textContent).not.toContain('Traceback');
    expect(section.textContent).not.toContain('result');
  });

  it('shows an interrupted task', async () => {
    show(task({ state: 'done', phase: 'interrupted', interrupt: true }));
    expect((await screen.findByTestId('bg:interrupted')).textContent).toContain('Interrupted');
  });

  it('shows the states of the reading', () => {
    const backend = new Backend().hold('GET', TASK);
    renderWithBazis(<TaskProgress id={ITEM_ID} path={ITEMS} />, backend);
    expect(screen.getByTestId('state:loading')).toBeTruthy();
  });

  it('shows a task that the user may not read as not found', async () => {
    show(errors(404), {}, 404);
    expect(await screen.findByTestId('state:not_found')).toBeTruthy();
  });

  it('needs the route of the tasks', () => {
    renderWithBazis(<TaskProgress id={ITEM_ID} path={null} />, new Backend());
    expect(screen.getByTestId('state:error').textContent).toContain('bazis-bg');
  });
});
