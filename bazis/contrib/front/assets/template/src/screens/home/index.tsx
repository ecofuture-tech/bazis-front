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

import { useLanguage } from '@/bazis/i18n';
import { Dashboard } from '@/bazis/ui/dashboard';

/**
 * The home, `spec/screens/home.yaml` (`primitive: dashboard`): the links to the other screens
 * of the navigation of the layout; the tiles, the charts and the last items that the spec
 * names are given to `Dashboard` here.
 */
export function HomeScreen() {
  const { t } = useLanguage();
  return <Dashboard title={t('home.title')} description={t('home.description')} />;
}
