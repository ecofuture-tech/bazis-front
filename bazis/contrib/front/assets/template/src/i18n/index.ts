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

// The dictionaries of the product by language, given to `LanguageProvider`
// (`src/app/providers.tsx`): a dictionary per language of the backend (`LANGUAGES` of
// `src/bazis/generated/contract.ts`), `src/i18n/<language>.ts`, imported here.

import type { Messages } from '@/bazis/i18n';

import { en } from '@/i18n/en';
import { ru } from '@/i18n/ru';

export const MESSAGES: Readonly<Record<string, Messages>> = { en, ru };
