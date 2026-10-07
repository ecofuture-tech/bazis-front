# End-to-end helpers

The helpers of the end-to-end tests of a product on
[Bazis](https://github.com/ecofuture-tech/bazis), over Playwright. Status: pre-release.

They are not an npm package: `manage.py bazis_front init` copies `bazis/index.ts` into the
frontend of a product, to `frontend/e2e/bazis/index.ts` (stamped, with its pristine copy in
`.bazis/base/` and its hash in the lock, like the client and the hooks: not edited).
`manage.py bazis_front e2e` generates a test per scenario of `spec/product.yaml` in
`frontend/e2e/generated/<scenario>.spec.ts` that calls them, and `e2e/generated/product.ts`
with `PRODUCT`, the part of the specs they read: the test user of each role (`test_user`)
and the route of each screen. The tests of the product (`e2e/custom/`) use them too.

```ts
import { test } from '@playwright/test';

import { loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

test('a manager finishes a task', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'manager');   // E2E_PASSWORD
  await app.open('task-list');
  await app.action('create');
  await app.fill({ title: 'Write the report' });
  await app.submit();
  await app.expectScreen('task-card');
  await app.transit('finish', { report: 'Done' });
  await app.expectStatus('done');
});
```

They act only through the `data-bz` marks of the screens (the components set them, and
their contract tests keep them), and wait with the auto-waiting of Playwright and on the
marks of the states, never for a fixed time:

| Helper | Step of a scenario | What it does |
|---|---|---|
| `loginAs(page, PRODUCT, role)` | the `role` of the scenario | logs in on `/login` (`LoginForm`) as the `test_user` of the role with the password of `E2E_PASSWORD`, and waits for `action:logout`; without bazis-users (`CAPABILITIES.users` of `contract.ts` is null) there is no login |
| `open(screen)` | `open` | goes to the route of the screen (one without the id of an item), then `expectScreen` |
| `openItem({where})` | `open_item` | clicks the first `row:<id>` of the current screen whose cells `cell:<name>` have exactly these texts (on the page shown) |
| `action(id)` | `action` | clicks `action:<id>` of the current screen (also `action:edit` of a card, before a `fill` of its edit) |
| `fill(values)` | `fill` | fills `field:<name>` of the open form: the `<form>` with `action:submit`; a select (a choice, a relationship) by the label of its option, a checkbox by true or false |
| `upload(field, file)` | `upload` | sets a file of `e2e/fixtures/` in `field:<name>` of the open form |
| `submit()` | `submit` | clicks `action:submit` of the open form and waits until it is closed or shows an error of this submit (`state:<error>`, `error:<name>`; those of a previous submit do not count) |
| `transit(id, payload?)` | `transit` | clicks `transit:<id>`, fills and submits the dialog of its payload, and waits until the transit is no longer offered or an error is shown |
| `expectScreen(id)` | `expect: {screen}`, and after a step that leads to another screen | `screen:<id>` is shown with a state rendered and nothing loading (`state:loading`); it is the current screen from then on |
| `expectStatus(id)` | `expect: {status}` | `status:<id>` in the current screen |
| `expectState(state)` | `expect: {state}` | `state:<state>` on the page |
| `expectActionAbsent(id)` | `expect: {action_absent}` | once the screen is loaded, it has no `action:<id>` |
| `expectFieldReadonly(name)` | `expect: {field_readonly}` | the open form has `field:<name>` read-only or disabled (or not at all); on a card, it has no `action:edit`, or its edit has the field read-only (the edit is opened and cancelled) |
| `expectRows(count)` | `expect: {rows}` | the number of `row:<id>` of the current screen |
| `expectError(name)` | `expect: {error}` | `error:<name>` on the page |

## Checks in this repository

`package.json`, `tsconfig.json`, `playwright.config.ts`, `test/` and `generated/` exist only
for the checks of this repository (`npm run typecheck`, `npm test` from the root, which
need the Chromium of Playwright: `npx playwright install chromium`) and are not in the
wheel. `generated/` is what `bazis_front e2e` renders from the specs of the sample of this
repository (`tests/test_e2e.py` fails when it differs: write it again with
`BAZIS_FRONT_WRITE_FIXTURES=1`); the helpers are type-checked against it, and the `@/`
import of `contract.ts` points to the fixture of the components. `test/helpers.spec.ts`
runs the helpers against pages with the marks of the components and the delays of a
backend; the end-to-end tests of the sample run in the `e2e` job of CI.
