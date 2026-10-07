# Tests of the product

The end-to-end tests written by hand, `<name>.spec.ts`, for what the scenarios of
`spec/product.yaml` do not express. `npm run e2e` runs them with the generated ones of
`../generated/` (never edited: `manage.py bazis_front e2e` writes them from the scenarios).
Use the helpers of `../bazis/` and the marks `data-bz` of the screens, as the generated
tests do:

```ts
import { test } from '@playwright/test';

import { loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

test('a viewer sees the tasks', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'viewer');
  await app.open('task-list');
  await app.expectState('loaded');
});
```
