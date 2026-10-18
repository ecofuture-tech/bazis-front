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

// The names of the icons of lucide-react that `bazis_front check` accepts in the specs (D013):
// bazis/contrib/front/spec/lucide-icons.json, read from the lucide-react of the workspace of
// the components (the version of the template), so that no check needs Node or the network.
// A name is kebab-case, as the specs and lucide.dev write it; the frontend imports its export
// in PascalCase (`building-2`: `Building2`), which every name listed has.
//
//   node scripts/gen_lucide_icons.mjs           write it again
//   node scripts/gen_lucide_icons.mjs --check   exit 1 if it differs (npm test)

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const FRONT = path.join(ROOT, 'bazis', 'contrib', 'front');
const OUTPUT = path.join(FRONT, 'spec', 'lucide-icons.json');

const require = createRequire(path.join(FRONT, 'assets', 'ui', 'package.json'));
const main = require.resolve('lucide-react');
const packageRoot = path.resolve(path.dirname(main), '..', '..');
const { version } = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const template = JSON.parse(fs.readFileSync(path.join(FRONT, 'assets', 'template', 'package.json'), 'utf8'));
const pinned = template.dependencies['lucide-react'];
if (pinned !== version) {
  console.error(`lucide-react ${version} is installed, the template has ${pinned}: run npm install.`);
  process.exit(1);
}

const exports = require('lucide-react');
// every icon by its kebab-case name, its aliases too
const { default: imports } = await import(pathToFileURL(path.join(packageRoot, 'dist', 'esm', 'dynamicIconImports.mjs')).href);
const pascal = (name) => name.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('');
const icons = Object.keys(imports)
  .filter((name) => exports[pascal(name)] !== undefined)
  .sort();

const text = `${JSON.stringify({ 'lucide-react': version, icons }, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
  if (current !== text) {
    console.error(`${path.relative(ROOT, OUTPUT)} is stale: run npm run lucide-icons.`);
    process.exit(1);
  }
} else {
  fs.writeFileSync(OUTPUT, text);
  console.log(`${path.relative(ROOT, OUTPUT)}: ${icons.length} icons of lucide-react ${version}`);
}
