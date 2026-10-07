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

// The contract of the status history: the status of the item since its date, by its author,
// each only when the item has the field (the field permissions of the user); no mark of its
// own (the status of a card is `status:<id>` of its badge). Keep it passing when the
// component is changed.

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusHistory } from '@/bazis/ui/status-history';
import { Backend, renderWithBazis, resource } from '@/bazis/ui/testing';

const DATE = '2026-01-02T03:04:05Z';
const AUTHOR = 'author-of-the-transit';

describe('StatusHistory', () => {
  it('shows the status since its date, by its author', () => {
    const item = resource(
      'a',
      { status_dt: DATE },
      { status: { type: 'statusy.status', id: 'draft' }, status_author: { type: 'test.user', id: AUTHOR } },
    );
    renderWithBazis(<StatusHistory resource={item} />, new Backend());
    const history = screen.getByRole('region', { name: 'Status history' });
    expect(history.textContent).toContain('draft');
    expect(history.querySelector('time')?.getAttribute('dateTime')).toBe(DATE);
    // the author of a resource without a route: the start of its id
    expect(history.textContent).toContain(`by #${AUTHOR.slice(0, 8)}`);
    expect(document.querySelector('[data-bz]')).toBeNull();
  });

  it('leaves out what the item does not have', () => {
    const item = resource('a', {}, { status: { type: 'statusy.status', id: 'draft' }, status_author: null });
    renderWithBazis(<StatusHistory resource={item} label="History" />, new Backend());
    const history = screen.getByRole('region', { name: 'History' });
    expect(history.querySelector('time')).toBeNull();
    expect(history.textContent).not.toContain('by');
  });

  it('renders nothing without a status', () => {
    const { container } = renderWithBazis(<StatusHistory resource={resource('a')} />, new Backend());
    expect(container.innerHTML).toBe('');
  });
});
