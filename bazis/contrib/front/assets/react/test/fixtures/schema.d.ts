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

// The types of the tests of the hooks, imported by them as `@/bazis/generated/schema` (the
// `paths` of tsconfig.json), as the hooks import them in a product. They are those of the
// core sample (the fixture of the client), whose route sets are not statusy: the endpoints
// that bazis-statusy adds to its route sets are added to `parent_entity`.

import type { paths as corePaths } from '../../../client/test/fixtures/schema.js';

type ParentItem = corePaths['/api/v1/entity/parent_entity/{item_id}/']['get'];

export type paths = corePaths & {
  '/api/v1/entity/parent_entity/{item_id}/transit/': {
    post: {
      requestBody: { content: { 'application/json': { transit: string; payload?: unknown } } };
      responses: ParentItem['responses'];
    };
  };
  '/api/v1/entity/parent_entity/{item_id}/schema_transit/': {
    get: corePaths['/api/v1/entity/parent_entity/{item_id}/schema_update/']['get'];
  };
};
