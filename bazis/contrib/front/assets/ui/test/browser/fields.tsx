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

// A page of the fields for the tests of their look in a browser
// (`assets/playwright/test/fields.spec.ts`, served by Vite with the aliases of `vitest.config.ts`
// and the Tailwind of a product): the row of the filters of a list (a select, the picker of a
// relation, a range of dates, an input), the line of the sort and the tools of a list in a section
// of a card, as wide as 20rem, 36rem and 45rem, three filters in a line as a calendar has them (45rem
// and 24rem), and the fields of a form in a dialog (an input, a
// native select, the picker of a relation, a date); the backend is the route of the test.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { createClient } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';
import { LanguageProvider } from '@/bazis/i18n';
import { BazisProvider } from '@/bazis/react';
import { DatePicker } from '@/bazis/ui/date-picker';
import { RelationPicker } from '@/bazis/ui/resource';
import { FilterField, FilterRow, filterWidth } from '@/bazis/ui/resource-list/filters';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ITEMS = '/api/test/item/';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const api = createClient<paths>({ baseUrl: window.location.origin, language: 'en' });

function Filters() {
  const [state, setState] = useState('all');
  const [owner, setOwner] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [title, setTitle] = useState('');
  return (
    <FilterRow>
      <FilterField label="State" id="f-state" kind="select" filled={state !== 'all'}>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger id="f-state" data-bz="field:state" className={filterWidth('select')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="new">New</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Owner" id="f-owner" kind="relation" filled={owner !== null}>
        <RelationPicker id="f-owner" relation="test.item" path={ITEMS} searchable data-bz="field:owner" className={filterWidth('relation')} value={owner} onChange={setOwner} />
      </FilterField>
      <FilterField label="Day" kind="date" filled={Boolean(from || to)}>
        <DatePicker data-bz="field:day__gte" aria-label="Day from" className="min-w-0 flex-1 @3xl:w-36 @3xl:flex-none" value={from} onChange={setFrom} />
        <span aria-hidden="true">—</span>
        <DatePicker data-bz="field:day__lte" aria-label="Day to" className="min-w-0 flex-1 @3xl:w-36 @3xl:flex-none" value={to} onChange={setTo} />
      </FilterField>
      <FilterField label="Title" id="f-title" kind="text" filled={title !== ''}>
        <Input id="f-title" data-bz="field:title" className={filterWidth('text')} value={title} onChange={(event) => { setTitle(event.target.value); }} />
      </FilterField>
    </FilterRow>
  );
}

function Lines() {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      {['20rem', '36rem', '45rem'].map((width) => (
        <div key={width} data-testid={`line:${width}`} style={{ width, maxWidth: '100%' }}>
          <FilterRow
            line
            tools={
              <>
                <Button type="button" variant="outline">
                  View
                </Button>
                <Button type="button">Add an item</Button>
              </>
            }
          >
            <FilterField label="Sort" id={`sort-${width}`} kind="select" filled={false}>
              <Select value="default">
                <SelectTrigger id={`sort-${width}`} className={filterWidth('select')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectItem value="default">By default</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </FilterRow>
        </div>
      ))}
    </div>
  );
}

/** The filters of a calendar: three in a line as wide as the calendar gives them, 45rem, and narrower. */
function CalendarFilters() {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      {['45rem', '24rem'].map((width) => (
        <div key={width} data-testid={`filters:${width}`} className="@container" style={{ width, maxWidth: '100%' }}>
          <FilterRow plate={false} line>
            {['state', 'owner', 'title'].map((name) => (
              <FilterField key={name} label={name} id={`${name}-${width}`} kind="text" filled={false}>
                <Input id={`${name}-${width}`} className={filterWidth('text')} />
              </FilterField>
            ))}
          </FilterRow>
        </div>
      ))}
    </div>
  );
}

function Form() {
  const [owner, setOwner] = useState<string | null>(null);
  const [due, setDue] = useState('');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button data-bz="action:open">Open</Button>
      </DialogTrigger>
      <DialogContent data-bz="form">
        <DialogTitle>Form</DialogTitle>
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" data-bz="field:name" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="source">Source</Label>
          <NativeSelect id="source" data-bz="field:source">
            <NativeSelectOption value="">—</NativeSelectOption>
            <NativeSelectOption value="web">Web</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="responsible">Responsible</Label>
          <RelationPicker id="responsible" relation="test.item" path={ITEMS} data-bz="field:responsible" value={owner} onChange={setOwner} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="due">Due</Label>
          <DatePicker id="due" data-bz="field:due" value={due} onChange={setDue} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <BazisProvider client={api} session="test" language="en">
          <main className="grid gap-6 bg-background p-4 md:p-8">
            <Filters />
            <Lines />
            <CalendarFilters />
            <Form />
          </main>
        </BazisProvider>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}
