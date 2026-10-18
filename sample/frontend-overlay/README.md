# The screens of the sample

The product code of the frontend of the sample: the list of the tasks
`src/screens/task-list/`, declared `custom: true` in its spec (`sample/spec/screens/`) for
what the spec cannot say — the number of the tasks of each status and their count by the
custom action `count` of the route set (`useAction`, followed by `TaskProgress`) — composed
with the tasks on a map (`ResourceMap`, `list.map`), the selected tasks started at once
(`bulk`) and the creation of a task as its spec describes them; the texts that it uses
(`src/i18n/`, over the texts of the specs that the screens generate), the files that the
scenarios upload (`e2e/fixtures/`) and the end-to-end tests of what no scenario says
(`e2e/custom/`: the custom actions, the downloads, the language, and the layout,
`layout.spec.ts`: the foot of the sidebar with its tools, and the filters of the list of the
tasks, a date range among them, at the width of a phone).

The other screens of the sample (the home, a dashboard with its tiles, its charts, the last
tasks and the creation of a task; the report `draft-tasks`; the card `task-card` in tabs with
the steps of the task and its history; the board `task-board`, moved by the menu of a card or
by drag and drop; the calendar `task-calendar`), their routes, the grouped navigation of
`sample/spec/product.yaml`, the providers (the socket of bazis-ws, the files of
bazis-uploadable, the maps, the dates) and the tools of the layout (`LiveQuery`,
`NotificationCenter` with the stored notifications of bazis-notify) are generated from the
specs in `src/screens/generated/` (their text is `tests/fixtures/screens/`).

A frontend is not kept in this repository: the `e2e` job of CI makes one from the sample
(`bazis_front init`, `contract`, `add` of the components, `npm install` for the npm
dependencies of `map`, `charts`, `date-picker` and `board-dnd`), copies these files over it,
generates the screens (`bazis_front screens`) and the end-to-end tests of the scenarios
(`bazis_front e2e`) and runs them against the sample backend. The files compile only there,
with the generated contract of the sample: the eslint of this repository ignores them.
