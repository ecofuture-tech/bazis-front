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

// The contract of the picker of a related item: a combobox marked as its field
// (`field:<name>`) with the label of the item, that opens a search over the list of the
// related resource (the backend searches, `Load more` reads the next page by its offset),
// selects with the mouse or the keyboard (the selected item active when it opens, the first
// item after a search, never the option that clears; Enter ignored while the options are
// those of another search; Escape and Tab give the focus back), announces the state of the
// search (`role="status"`) and clears a nullable value (the option `data-value=""`, which the
// helpers of the end-to-end tests choose for null). The labels of the related items shown
// together are read with one request. Keep it passing when the component is changed.

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { FieldValue, PICKER_PAGE, RelationLabel, RelationPicker } from '@/bazis/ui/resource';
import { Backend, ITEMS, listDocument, renderWithBazis, resource } from '@/bazis/ui/testing';

// the popover is positioned with ResizeObserver and the active option scrolled into view,
// which jsdom does not have
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

const ann = resource('a1', { name: 'Ann' });
const bob = resource('b2', { name: 'Bob' });

/** The query of the labels of these ids, as the hooks encode it. */
const labels = (ids: readonly string[]) =>
  `GET ${ITEMS}?filter=${ids.map((id) => `pk%3D${id}`).join('%7C')}&page%5Blimit%5D=${String(ids.length)}`;
const page = (limit: number, search?: string) =>
  `GET ${ITEMS}?${search ? `search=${search}&` : ''}page%5Blimit%5D=${String(limit)}`;

function Picker({ initial = null, onChange = vi.fn(), nullable }: { initial?: string | null; onChange?: (id: string | null) => void; nullable?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <RelationPicker
      relation="test.item"
      path={ITEMS}
      data-bz="field:owner"
      aria-label="Owner"
      value={value}
      {...(nullable === undefined ? {} : { nullable })}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

async function open(): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId('field:owner'));
  return screen.findByRole('listbox');
}

describe('RelationPicker', () => {
  it('shows the label of its item and selects another one', async () => {
    const backend = new Backend().on('GET', ITEMS, listDocument([ann, bob]));
    const onChange = vi.fn();
    renderWithBazis(<Picker initial="a1" onChange={onChange} />, backend);
    const trigger = screen.getByTestId('field:owner');
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(await within(trigger).findByText('Ann')).toBeTruthy();
    expect(backend.requests()).toEqual([labels(['a1'])]);

    const listbox = await open();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    // the popover of the trigger has the search and the options
    const popup = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
    expect(popup?.contains(listbox)).toBe(true);
    await within(listbox).findByText('Bob');
    expect(backend.requests()).toContain(page(PICKER_PAGE));
    const options = within(listbox).getAllByRole('option');
    // the option that clears the value, then the items; the value is selected
    expect(options.map((it) => it.getAttribute('data-value'))).toEqual(['', 'a1', 'b2']);
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(within(listbox).getByText('Bob'));
    expect(onChange).toHaveBeenLastCalledWith('b2');
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
    // the label of the chosen item, without another request
    expect(trigger.textContent).toBe('Bob');
    expect(backend.requests().filter((it) => it.includes('filter='))).toHaveLength(1);
  });

  it('is searched by the backend and read page after page', async () => {
    const backend = new Backend()
      .on('GET', ITEMS, listDocument([ann], { next: `${ITEMS}?page%5Boffset%5D=${String(PICKER_PAGE)}` }))
      .on('GET', `${ITEMS}?page%5Blimit%5D=${String(PICKER_PAGE)}&page%5Boffset%5D=${String(PICKER_PAGE)}`, listDocument([bob]))
      .on('GET', `${ITEMS}?search=zz&page%5Blimit%5D=${String(PICKER_PAGE)}`, listDocument([]));
    renderWithBazis(<Picker nullable={false} />, backend);
    expect(screen.getByTestId('field:owner').textContent).toBe('—');

    const listbox = await open();
    fireEvent.click(await within(listbox).findByText('Load more'));
    // the next page by its offset, never a larger page (the backend has a maximum)
    await waitFor(() => {
      expect(within(listbox).getAllByRole('option').map((it) => it.textContent)).toEqual(['Ann', 'Bob']);
    });
    expect(backend.requests().every((it) => it.includes(`page%5Blimit%5D=${String(PICKER_PAGE)}`))).toBe(true);
    // not nullable: no option clears the value
    expect(within(listbox).queryByText('—')).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Search Owner' }), { target: { value: 'zz' } });
    // the state of the search is announced
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Nothing matches the search.');
    });
  });

  it('keeps its value on Enter and selects the first item found', async () => {
    const backend = new Backend()
      .on('GET', ITEMS, listDocument([ann, bob]))
      .on('GET', `${ITEMS}?search=bob&page%5Blimit%5D=${String(PICKER_PAGE)}`, listDocument([bob]));
    const onChange = vi.fn();
    renderWithBazis(<Picker initial="a1" onChange={onChange} />, backend);
    const trigger = screen.getByTestId('field:owner');

    // opened, the selected item is active (not the option that clears the value)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const listbox = await screen.findByRole('listbox');
    await within(listbox).findByText('Bob');
    const search = screen.getByRole('combobox', { name: 'Search Owner' });
    expect(document.activeElement).toBe(search);
    expect(search.getAttribute('aria-activedescendant')).toBe(within(listbox).getByText('Ann').closest('li')?.id);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('a1');
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    // typed: Enter waits for the items of the search, then selects the first one
    fireEvent.click(trigger);
    const again = await screen.findByRole('listbox');
    const input = screen.getByRole('combobox', { name: 'Search Owner' });
    fireEvent.change(input, { target: { value: 'bob' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(within(again).getAllByRole('option').map((it) => it.textContent)).toEqual(['—', 'Bob']);
    });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('b2');
  });

  it('clears its value and gives the focus back on Escape and Tab', async () => {
    const backend = new Backend().on('GET', ITEMS, listDocument([ann, bob]));
    const onChange = vi.fn();
    renderWithBazis(<Picker initial="a1" onChange={onChange} />, backend);
    const trigger = screen.getByTestId('field:owner');

    for (const key of ['Escape', 'Tab']) {
      await open();
      fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search Owner' }), { key });
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeNull();
      });
      expect(document.activeElement).toBe(trigger);
    }
    expect(onChange).not.toHaveBeenCalled();

    const listbox = await open();
    fireEvent.click(listbox.querySelector('[data-value=""]') as Element);
    expect(onChange).toHaveBeenLastCalledWith(null);
    await waitFor(() => {
      expect(trigger.textContent).toBe('—');
    });
  });

  it('is disabled when read-only, an input without a route for its resource', () => {
    renderWithBazis(
      <>
        <RelationPicker relation="test.item" path={ITEMS} data-bz="field:owner" value={null} disabled aria-readonly onChange={vi.fn()} />
        <RelationPicker relation="test.unknown" data-bz="field:other" value="x1" onChange={vi.fn()} />
      </>,
      new Backend(),
    );
    const trigger = screen.getByTestId('field:owner');
    expect(trigger.hasAttribute('disabled')).toBe(true);
    expect(trigger.getAttribute('aria-readonly')).toBe('true');
    expect(screen.getByTestId<HTMLInputElement>('field:other').value).toBe('x1');
  });
});

describe('RelationLabel', () => {
  it('reads the labels of the items shown together with one request', async () => {
    const backend = new Backend().on('GET', ITEMS, listDocument([ann, bob]));
    renderWithBazis(
      <>
        {['a1', 'b2', 'c3', 'a1'].map((id, index) => (
          <p key={index}>
            <RelationLabel relation="test.item" path={ITEMS} id={id} />
          </p>
        ))}
        {/* a resource without a route: the id, no request */}
        <FieldValue field={{ kind: 'relation', name: 'x', title: 'x', relation: 'test.unknown', many: true, required: false, readOnly: false, nullable: false }} value={['x1']} />
      </>,
      backend,
    );
    expect(await screen.findAllByText('Ann')).toHaveLength(2);
    expect(screen.getByText('Bob')).toBeTruthy();
    // an item that the list does not have (the user may not view it): its id
    await screen.findByText('c3');
    expect(screen.getByText('x1')).toBeTruthy();
    expect(backend.requests()).toEqual([labels(['a1', 'b2', 'c3'])]);
    await act(() => Promise.resolve());
  });
});
