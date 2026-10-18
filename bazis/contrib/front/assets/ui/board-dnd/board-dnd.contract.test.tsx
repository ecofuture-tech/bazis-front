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

// The contract of the drag and drop of the boards: the board is loading until @dnd-kit is
// loaded, a column is where a card is dropped (its status the id of the drop), a card is
// dragged by its id, and a card dropped on another column runs the transit of the item to its
// status. @dnd-kit is replaced by a fake that
// records the drops and the drags it is asked for: jsdom has no pointer to drag with. Keep it
// passing when the component is changed.

import { act, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BoardDnd } from '@/bazis/ui/board-dnd';
import { ResourceBoard } from '@/bazis/ui/resource-board';
import { Backend, ITEMS, listDocument, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

/** A card or a column of @dnd-kit: its id and its data. */
interface Part {
  id: string;
  data: { current: { label: string | null } };
}

/** What the screen readers are told of a drag (`accessibility` of `DndContext`). */
interface Accessibility {
  screenReaderInstructions: { draggable: string };
  announcements: {
    onDragStart: (event: { active: Part }) => string;
    onDragOver: (event: { active: Part; over: Part | null }) => string;
    onDragEnd: (event: { active: Part; over: Part | null }) => string;
    onDragCancel: (event: { active: Part }) => string;
  };
}

const fake = vi.hoisted(() => ({
  drop: null as ((event: { active: { id: string }; over: { id: string } | null }) => void) | null,
  accessibility: null as Accessibility | null,
  droppables: [] as string[],
  draggables: [] as string[],
  labels: new Map<string, string | null>(),
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ onDragEnd, accessibility, children }: { onDragEnd: typeof fake.drop; accessibility: Accessibility; children: ReactNode }) => {
    fake.drop = onDragEnd;
    fake.accessibility = accessibility;
    return children;
  },
  MouseSensor: {},
  TouchSensor: {},
  useSensor: () => ({}),
  useSensors: () => [],
  useDroppable: ({ id, data }: { id: string; data: { label: string } }) => {
    fake.droppables.push(id);
    fake.labels.set(id, data.label);
    return { setNodeRef: () => undefined, isOver: false };
  },
  useDraggable: ({ id, data }: { id: string; data: { label: string | null } }) => {
    fake.draggables.push(id);
    fake.labels.set(id, data.label);
    return { setNodeRef: () => undefined, listeners: {}, transform: null, isDragging: false };
  },
}));

const schema = runtimeSchema({ title: { attribute: { type: 'string', title: 'Title' } }, status: { relation: 'statusy.status' } }, { list: true });

describe('BoardDnd', () => {
  it('drops a card on a column: the transit of the item to its status', async () => {
    const start = {
      code: 'ACTION_TRANSIT',
      endpoint: { url: `${ITEMS}a/transit/`, method: 'POST', body: { type: 'object', properties: { transit: { type: 'string', default: 'start' }, payload: { anyOf: [{ type: 'object' }, { type: 'null' }] } } } },
      restricts: null,
      resource: { type: 'test.item', id: 'a' },
    };
    const item = resource('a', { title: 'A' }, { status: { type: 'statusy.status', id: 'draft' } });
    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, schema)
      .on('GET', ITEMS, listDocument([item]))
      .on('GET', `${ITEMS}a/`, { data: item, meta: { state_actions: [start] } })
      .on('POST', `${ITEMS}a/transit/`, { data: item });
    renderWithBazis(
      <BoardDnd>
        <ResourceBoard path={ITEMS as never} entity="item" columns={['draft', 'start']} title="title" move />
      </BoardDnd>,
      server,
    );
    // the board waits for @dnd-kit
    expect(screen.getByTestId('state:loading')).toBeTruthy();
    await waitFor(() => {
      expect(fake.drop).not.toBeNull();
    });
    await screen.findAllByTestId('row:a');
    expect(fake.droppables).toEqual(expect.arrayContaining(['draft', 'start']));
    expect(fake.draggables).toContain('a');
    // dropped outside a column, or on its own: nothing
    act(() => {
      fake.drop?.({ active: { id: 'a' }, over: null });
      fake.drop?.({ active: { id: 'a' }, over: { id: 'draft' } });
    });
    // the contract of the tests knows no status of its transits: the transit names the column
    act(() => {
      fake.drop?.({ active: { id: 'a' }, over: { id: 'start' } });
    });
    await waitFor(() => {
      expect(server.calls.filter((it) => it.method === 'POST').map((it) => it.body)).toEqual([{ transit: 'start' }]);
    });
  });

  it('tells the screen readers the drag by the names of the item and the status, never their ids', async () => {
    const item = resource('item-0001', { title: 'Write the report' }, { status: { type: 'statusy.status', id: 'draft' } });
    const unnamed = resource('item-0002', {}, { status: { type: 'statusy.status', id: 'draft' } });
    renderWithBazis(
      <BoardDnd>
        <ResourceBoard path={ITEMS as never} entity="item" columns={['draft', 'start']} title="title" move />
      </BoardDnd>,
      new Backend().on('GET', `${ITEMS}schema_list/`, schema).on('GET', ITEMS, listDocument([item, unnamed])),
    );
    await screen.findAllByTestId('row:item-0002');
    const part = (id: string): Part => ({ id, data: { current: { label: fake.labels.get(id) ?? null } } });
    const told = fake.accessibility;
    if (told === null) throw new Error('no accessibility');
    const said = [
      told.announcements.onDragStart({ active: part('item-0001') }),
      told.announcements.onDragStart({ active: part('item-0002') }),
      told.announcements.onDragOver({ active: part('item-0001'), over: part('start') }),
      told.announcements.onDragOver({ active: part('item-0001'), over: null }),
      told.announcements.onDragEnd({ active: part('item-0001'), over: part('start') }),
      told.announcements.onDragCancel({ active: part('item-0001') }),
    ];
    expect(said[0]).toContain('Write the report');
    expect(said[1]).toContain('a card');
    expect(said[2]).toContain(fake.labels.get('start'));
    // the texts of the language, not their keys, and never the id of an item
    for (const text of [...said, told.screenReaderInstructions.draggable]) {
      expect(text).not.toMatch(/item-000|\{|board\./);
    }
  });
});
