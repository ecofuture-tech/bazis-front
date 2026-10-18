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

// The drag and drop of a board, which the component board-dnd gives it (`BoardDnd`, with
// @dnd-kit): the area of the board, where a card is dropped on a column, its columns and its
// cards. Without it a card is moved by its menu only (`action:move`), which the keyboard
// and the scenarios use anyway.

import { createContext, use, type ComponentType, type ReactNode } from 'react';

/** The parts of the drag and drop of a board. */
export interface BoardDrag {
  /** The board: `onDrop` gets the id of a card dropped on another column, and the status of that one. */
  Area: ComponentType<{ onDrop: (id: string, status: string) => void; children: ReactNode }>;
  /** A column, where a card is dropped; `label`: the name of its status, for the screen readers. */
  Column: ComponentType<{ status: string; label: string; children: ReactNode }>;
  /** A card, which is dragged; `label`: the name of its item, for the screen readers (none without one). */
  Card: ComponentType<{ id: string; label: string | null; children: ReactNode }>;
}

/** A part without drag and drop: its children as they are. */
function Plain({ children }: { children: ReactNode }) {
  return children;
}

const NONE: BoardDrag = { Area: Plain, Column: Plain, Card: Plain };

const DragContext = createContext<BoardDrag>(NONE);

/** Gives the boards below it their drag and drop (`BoardDnd` of board-dnd). */
export function BoardDragProvider({ drag, children }: { drag: BoardDrag; children: ReactNode }) {
  return <DragContext value={drag}>{children}</DragContext>;
}

/** The drag and drop of a board whose cards `move`: none without `BoardDragProvider`, or when they do not. */
export function useBoardDrag(move: boolean): BoardDrag {
  return move ? use(DragContext) : NONE;
}
