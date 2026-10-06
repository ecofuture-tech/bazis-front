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

// Builds the type-test fixture from the OpenAPI of the core `sample/` project:
// the paths of two route sets and the component schemas they reference, transitively,
// into test/fixtures/openapi.json; then generates test/fixtures/schema.d.ts from it
// with openapi-typescript, the same way a project generates its contract.
//
// Usage: npm run fixture -w @bazis/client -- <openapi.json of the core sample>
//
// The core exports its OpenAPI without a server: in `sample/` of the core, with the
// settings of its tests, `django.setup()` and `json.dumps(bazis.core.app.app.openapi())`.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROUTE_SETS = ['/api/v1/entity/parent_entity/', '/api/v1/entity/child_entity/'];
const REF_PREFIX = '#/components/schemas/';

const source = process.argv[2];
if (!source) {
  console.error('usage: extract-fixture.mjs <openapi.json>');
  process.exit(2);
}

const spec = JSON.parse(readFileSync(source, 'utf8'));

const paths = Object.fromEntries(
  Object.entries(spec.paths).filter(([path]) =>
    ROUTE_SETS.some((prefix) => path.startsWith(prefix)),
  ),
);

const schemas = {};
const pending = [paths];
while (pending.length) {
  const node = pending.pop();
  if (Array.isArray(node)) {
    pending.push(...node);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string' && value.startsWith(REF_PREFIX)) {
        const name = value.slice(REF_PREFIX.length);
        if (!(name in schemas)) {
          schemas[name] = spec.components.schemas[name];
          pending.push(schemas[name]);
        }
      } else {
        pending.push(value);
      }
    }
  }
}

const fixture = {
  openapi: spec.openapi,
  info: spec.info,
  paths,
  components: {
    schemas: Object.fromEntries(Object.keys(schemas).sort().map((name) => [name, schemas[name]])),
  },
};

const fixtures = new URL('../test/fixtures/', import.meta.url);
const jsonPath = fileURLToPath(new URL('openapi.json', fixtures));
const typesPath = fileURLToPath(new URL('schema.d.ts', fixtures));

writeFileSync(jsonPath, `${JSON.stringify(fixture, null, 2)}\n`);
execFileSync(
  'npx',
  ['openapi-typescript', jsonPath, '-o', typesPath, '--default-non-nullable=false'],
  { stdio: 'inherit' },
);
console.log(
  `${Object.keys(paths).length} paths, ${Object.keys(schemas).length} schemas -> ${jsonPath}`,
);
