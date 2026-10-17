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

// The drag and drop of the boards with @dnd-kit/core (the npm dependency that
// `bazis_front add board-dnd` sets in package.json), a chunk of its own loaded with the first
// board shown (`board-dnd.tsx`; its default export): a card is dragged by the mouse once it moved a few pixels
// (its click still opens it), or by a touch held a moment (a short one scrolls the board), and
// dropped on a column. The keyboard moves a card by its menu.

import { DndContext, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import type { ReactNode } from 'react';

import { BoardDragProvider, type BoardDrag } from '@/bazis/ui/resource-board';
import { cn } from '@/lib/utils';

/** The board: a card dropped on a column gives its id and the status of the column. */
export function DndArea({ onDrop, children }: { onDrop: (id: string, status: string) => void; children: ReactNode }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  return (
    <DndContext
      sensors={sensors}
      onDragEnd={({ active, over }) => {
        if (over) onDrop(String(active.id), String(over.id));
      }}
    >
      {children}
    </DndContext>
  );
}

/** A column, highlighted while a card is over it. */
export function DndColumn({ status, children }: { status: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      data-over={isOver || undefined}
      className="flex shrink-0 snap-start rounded-xl transition-shadow data-over:ring-2 data-over:ring-primary/40"
    >
      {children}
    </div>
  );
}

/** A card, which follows the pointer while it is dragged. */
export function DndCard({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, listeners, transform, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={transform ? { transform: `translate3d(${String(transform.x)}px, ${String(transform.y)}px, 0)` } : undefined}
      className={cn(isDragging && 'relative z-20 cursor-grabbing opacity-90 shadow-lg')}
    >
      {children}
    </div>
  );
}

const DRAG: BoardDrag = { Area: DndArea, Column: DndColumn, Card: DndCard };

/** The boards below it move their cards by drag and drop. */
export default function DndBoards({ children }: { children: ReactNode }) {
  return <BoardDragProvider drag={DRAG}>{children}</BoardDragProvider>;
}
