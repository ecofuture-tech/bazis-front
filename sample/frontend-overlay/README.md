# The screens of the sample

The product code of the frontend of the sample: its screens (the home `src/screens/home/`,
a `Dashboard` with its tiles, its charts, the last tasks and the creation of a task;
`src/screens/task-list/`, with the tasks on a map (`ResourceMap`, `list.map`), their count by
the custom action `count` of the route set (`useAction`, followed by `TaskProgress`) and the
selected tasks started at once (`bulk`), `src/screens/task-card/` in tabs with the steps of
the task, its related section `RelatedList`, and its history, the board
`src/screens/task-board/` (`ResourceBoard` with the drag and drop of `BoardDnd`), the calendar
`src/screens/task-calendar/` (`ResourceCalendar`), the report `src/screens/draft-tasks/`),
composed from the components as the specs of the sample (`sample/spec/screens/`) describe
them, the router of the template with their routes (`src/app/router.tsx`, inside
`SocketProvider`, the socket of bazis-ws with the token of the session, `FileFieldProvider`:
the forms upload the files of bazis-uploadable, `MapProvider` with the tiles of `MAP_TILES`
of `src/app/product.ts`, and `DatePickerProvider`: the dates are picked in a calendar; the
`tools` of the layout are `LiveQuery` and `NotificationCenter` with the stored notifications
of bazis-notify, `useInbox`), the files that the scenarios upload (`e2e/fixtures/`) and the
end-to-end tests of what no scenario says (`e2e/custom/`: the custom actions, the downloads,
the language, and the layout, `layout.spec.ts`: the foot of the sidebar with these tools, and
the filters of the list of the tasks, a date range among them, at the width of a phone). It
is the reference of a product frontend written from its specs.

A frontend is not kept in this repository: the `e2e` job of CI makes one from the sample
(`bazis_front init`, `contract`, `add` of the components, `npm install` for the npm
dependencies of `map`, `charts`, `date-picker` and `board-dnd`), copies these files over it, generates
the end-to-end tests of the scenarios (`bazis_front e2e`) and runs them against the sample
backend. The files compile only there, with the generated contract of the sample: the eslint
of this repository ignores them.
