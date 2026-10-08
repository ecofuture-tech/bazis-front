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

import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BG_POLL_INTERVAL, bgProgress, bgTask, useBgTask } from '../src/bg/index.js';
import { useItem } from '../src/index.js';
import sample from './fixtures/sample.json' with { type: 'json' };
import { Backend, cachedKeys, PARENT, render } from './support.js';

// the route set of the fixture stands for the one of `bg.task`
const TASKS = PARENT;
const ID = sample.bg_task_waiting.data.id;

afterEach(() => {
  vi.useRealTimers();
});

describe('bgTask', () => {
  it('reads the tasks of the sample', () => {
    expect(bgTask(sample.bg_task_waiting)).toEqual({
      id: ID,
      name: 'Count the tasks',
      state: 'waiting',
      phase: 'waiting for start',
      outcome: null,
      progress: [],
      result: null,
      started: null,
      finished: null,
    });
    expect(bgTask(sample.bg_task_running)).toMatchObject({
      state: 'running',
      phase: 'Count the tasks',
      progress: [{ key: null, expected: 2, performed: 1 }],
    });
    expect(bgTask(sample.bg_task_done)).toMatchObject({
      state: 'done',
      phase: 'completed',
      outcome: 'success',
      progress: [],
      result: { done: 1, in_progress: 1 },
      finished: '2026-01-01T00:00:00Z',
    });
  });

  it('reads a failure and an interruption', () => {
    const done = sample.bg_task_done.data;
    const failed = { data: { ...done, attributes: { ...done.attributes, phase: 'error', error: 'Traceback…' } } };
    expect(bgTask(failed).outcome).toBe('error');
    const interrupted = { data: { ...done, attributes: { ...done.attributes, phase: 'interrupted', interrupt: true } } };
    expect(bgTask(interrupted).outcome).toBe('interrupted');
  });

  it('reads counters by key', () => {
    expect(bgProgress({ rows: 10, files: 2 }, { rows: 4 })).toEqual([
      { key: 'rows', expected: 10, performed: 4 },
      { key: 'files', expected: 2, performed: null },
    ]);
    expect(bgProgress(null, 3)).toEqual([{ key: null, expected: null, performed: 3 }]);
    expect(bgProgress(null, null)).toEqual([]);
  });
});

describe('useBgTask', () => {
  it('reads the task until it is done, with the query of the item', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const backend = new Backend().on('GET', `${TASKS}${ID}/`, sample.bg_task_running);
    const { result, queryClient } = render(() => ({ task: useBgTask(TASKS, ID), item: useItem(TASKS, ID) }), backend);
    await vi.waitFor(() => {
      expect(result.current.task.data?.state).toBe('running');
    });
    // one query, shared with useItem
    expect(cachedKeys(queryClient)).toEqual([['bazis', TASKS, 'item', ID, {}, 's1']]);
    expect(result.current.item.data).toEqual(sample.bg_task_running);
    backend.on('GET', `${TASKS}${ID}/`, sample.bg_task_done);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BG_POLL_INTERVAL);
    });
    expect(result.current.task.data?.outcome).toBe('success');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BG_POLL_INTERVAL * 3);
    });
    expect(backend.requests('GET')).toHaveLength(2);
  });

  it('reads nothing without a task', () => {
    const backend = new Backend();
    const { result } = render(() => useBgTask(TASKS, null), backend);
    expect(result.current.data).toBeUndefined();
    expect(backend.calls).toEqual([]);
  });
});
