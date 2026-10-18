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

// A screen written by hand (`custom: true` of spec/screens/about.yaml, the kitchen sink): the
// generator gives it its route, its link and its texts.

import { useLanguage } from '@/bazis/i18n';
import { Screen } from '@/bazis/ui/app-shell';

export function AboutScreen() {
  const { t } = useLanguage();
  return (
    <Screen id="about" title={t('screens.about.title')}>
      <p>A product of the kitchen sink.</p>
    </Screen>
  );
}
