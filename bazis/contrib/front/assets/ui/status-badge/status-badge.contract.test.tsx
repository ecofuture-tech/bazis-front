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

// The contract of the status badge: `status:<id>` of the status of the item in the tone of
// the theme, nothing without one. Keep it passing when the component is changed.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge, statusName, statusOptions, statusTone } from '@/bazis/ui/status-badge';
import { resource } from '@/bazis/ui/testing';

describe('StatusBadge', () => {
  it('marks the status of the item', () => {
    render(<StatusBadge resource={resource('a', {}, { status: { type: 'statusy.status', id: 'draft' } })} />);
    // a model that the contract does not have: the id of the status
    expect(screen.getByTestId('status:draft').textContent).toBe('draft');
    // the tone of `statuses` of the theme, neutral for a status it does not name
    expect(screen.getByTestId('status:draft').getAttribute('data-tone')).toBe(statusTone('draft'));
    expect(statusTone('a-status-of-no-theme')).toBe('neutral');
  });

  it('renders nothing without a status', () => {
    const { container } = render(<StatusBadge resource={resource('a')} />);
    expect(container.innerHTML).toBe('');
    expect(statusName('test.item', 'done')).toBe('done');
    expect(statusOptions('test.item')).toEqual([]);
  });
});
