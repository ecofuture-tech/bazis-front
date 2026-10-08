# The screens of the sample

The product code of the frontend of the sample: its screens (`src/screens/task-list/`,
`src/screens/task-card/`), composed from the components as the specs of the sample
(`sample/spec/screens/`) describe them, the router of the template with their routes
(`src/app/router.tsx`, inside `SocketProvider`, the socket of bazis-ws with the token of the
session, and `FileFieldProvider`: the forms upload the files of bazis-uploadable; the
`tools` of the layout are `LiveQuery` and `NotificationCenter`), and the files that the scenarios upload (`e2e/fixtures/`). It is the
reference of a product frontend written from its specs.

A frontend is not kept in this repository: the `e2e` job of CI makes one from the sample
(`bazis_front init`, `contract`, `add` of the components), copies these files over it, generates
the end-to-end tests of the scenarios (`bazis_front e2e`) and runs them against the sample
backend. The files compile only there, with the generated contract of the sample: the eslint
of this repository ignores them.
