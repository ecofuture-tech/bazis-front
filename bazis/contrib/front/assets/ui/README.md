# Components

The visual building blocks of the frontend of a product on
[Bazis](https://github.com/ecofuture-tech/bazis): React components on shadcn/ui and
Tailwind 4 over the hooks (`assets/react`). Status: pre-release.

The components are not an npm package: `manage.py bazis_front add <component>...` copies
them into the frontend of a product, to `frontend/src/bazis/ui/<component>/` (imported as
`@/bazis/ui/<component>`), with the assets they require, their pristine copies in
`.bazis/base/` and their hashes in the lock; `init` copies `state-panel`, `app-shell` and
`login-form`, which the template uses. Unlike the client and the hooks, the product owns the
copies and changes them freely; each component comes with its contract test
(`<component>.contract.test.tsx`), which checks the `data-bz` marks and the states that the
scenarios of the specs rely on: keep it passing.

The shadcn/ui components they use (`button`, `input`, `label`, `native-select`, `table`,
`badge`, `card`, `dialog`) are assets as well, copied into `src/components/ui/` as
`components.json` of the template places them, so that `add` needs neither the network nor
the shadcn CLI. Their npm dependencies (`radix-ui`, `class-variance-authority`,
`lucide-react`) and those of the contract tests (`@testing-library/react`, `jsdom`) are in
the `package.json` of the template: `add` never changes the `package.json` of a product.

Labels come from the backend (the titles of the runtime schemas, the names of the statuses
and transits in `contract.ts`) and from the props; there are no translations. Colors, radii
and fonts are the CSS variables of the template.

## The components

| Component | Props | `data-bz` | Requires |
|---|---|---|---|
| `state-panel` | `StatePanel({state, error?, message?, onRetry?, inline?, children})`; `errorState(error)`, `queryState(query, empty?)` | `state:<state>`, `action:retry` | |
| `app-shell` | `AppShell({title, navigation: 'sidebar' \| 'topbar', items: [{screen, label, to, end?}], session: {user?, onLogout} \| null, children})`; `Screen({id, title?, actions?, children})` | `nav:<screen>`, `screen:<id>`, `action:logout` | |
| `login-form` | `LoginForm({onLogin(credentials), onSuccess?, title?})` | `field:username`, `field:password`, `action:submit`, `state:error` | |
| `resource-list` | `ResourceList({path, entity, columns, filters?, sort?, search?, pageSize?, onOpen?, actions?, rowActions?, cells?, emptyMessage?})` | `list:<entity>`, `row:<id>`, `state:<loading\|empty\|loaded\|error\|forbidden>`, `field:<filter>`, `field:$search`, `action:<id>`, `action:prev-page`, `action:next-page` | |
| `resource-card` | `ResourceCard({path, id, sections: [{id, title?, fields}], title?, badge?, edit?, actions?, values?, children})` | `state:<loading\|loaded\|error\|forbidden\|not_found>`, `field:<name>`, `action:edit`, `action:<id>` | |
| `resource-form` | `ResourceForm({path, id?, fields?, onSaved?, onCancel?, submitLabel?})` | `state:<loading\|loaded\|error\|forbidden\|invalid>`, `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | |
| `status-badge` | `StatusBadge({resource})`; `statusOf`, `statusName`, `statusOptions`, `transitName` | `status:<id>` | capability `statusy` |
| `transit-bar` | `TransitBar({path, id, onDone?})`; `payloadErrors(error)` | `transit:<id>`, `state:<loading\|error\|forbidden>`, in the dialog of a payload `field:<name>`, `error:<name>`, `action:submit`, `action:cancel` | capability `statusy` |

`resource` is what they share: `FieldInput` (the input of a field of a runtime schema, the
only one: the forms and the payloads of the transits use it), `FieldValue`,
`RelationSelect` and `RelationLabel` (the related resource by its route in `ROUTES`),
`useListFields`/`useItemFields` (the titles and types of the list and retrieve schemas),
`permitted(meta, action, id?)` (the permission meta of bazis-permit; allowed when the
backend does not report it), and the hooks with plain paths for the bodies of the
components. `testing` is the support of the contract tests: a backend for the mocked
`fetch` of the client, the documents and runtime schemas of Bazis, `renderWithBazis`, and
`getByTestId` reading `data-bz`.

- **`state-panel`** is the only place where an error of the backend becomes a state: 401
  and 403 are `forbidden`, 404 `not_found`, 422 `invalid`, any other `error`.
- **`resource-list`** reads the list with `useList` (`meta`: `pagination`, `for_create`,
  `for_change`, `for_delete`), the titles of the columns from `schema_list/`, the types of
  the filters from `route_filter_fields/` (a relation: a select of the related resource; a
  date: a range; a string: `<field>__$search`; `options` for choices such as the statuses),
  the sort labels from `RESOURCES` of the contract. An action with `permission` is shown
  only when the permission meta allows it.
- **`resource-card`** reads the item with `crud_actions` and its fields from
  `schema_retrieve/`; with `edit`, an edit button (when the backend allows the change)
  replaces the sections with the form of the update of their fields.
- **`resource-form`** is `useResourceForm`: the fields of `schema_create/` or
  `schema_update/` of the current user, read-only ones disabled and never sent; a to-one
  relationship is a select of the related resource (its first 100 items); to-many
  relationships are left out (`useRelationship`).
- **`transit-bar`** shows the transits of `meta.state_actions` (disabled with the errors of
  their validators when restricted); a transit whose action takes a typed payload opens a
  dialog with its fields, and the errors of a 422 (`/payload/<name>`) are shown by field.
  `onDone(null)`: the user can no longer view the item.

## A screen

```tsx
import { useNavigate } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { Screen } from '@/bazis/ui/app-shell';
import { ResourceList } from '@/bazis/ui/resource-list';
import { StatusBadge, statusOptions } from '@/bazis/ui/status-badge';

const TASKS = ROUTES['tasks.task'];

export function TaskListScreen() {
  const navigate = useNavigate();
  return (
    <Screen id="task-list" title="Tasks">
      <ResourceList
        path={TASKS}
        entity="task"
        columns={['title', 'status', 'assignee', 'dt_created']}
        filters={[{ field: 'status', options: statusOptions('tasks.task') }, 'assignee']}
        sort={['-dt_created']}
        search
        onOpen={(id) => void navigate(`/tasks/${id}`)}
        cells={{ status: (row) => <StatusBadge resource={row} /> }}
      />
    </Screen>
  );
}
```

## Checks in this repository

`package.json`, `tsconfig.json`, `vitest.config.ts` and `test/` exist only for the checks
of this repository (`npm run typecheck`, `npm test` from the root) and are not in the
wheel; the contract tests are, since they are copied into products. In this repository the
`@/` imports point to the assets next to them, to `src/lib/utils.ts` of the template and to
`test/fixtures/contract.ts`, the `contract.ts` of the sample of this repository (rendered by
`contract/typescript.py` from its `contract.json`).

## The license of shadcn/ui

The files of `shadcn/` are the components of [shadcn/ui](https://ui.shadcn.com) (style
`new-york-v4`) with the aliases of `components.json`; each keeps this notice in its header:

```
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
