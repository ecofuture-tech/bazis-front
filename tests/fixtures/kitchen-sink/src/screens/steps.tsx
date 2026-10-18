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

// A module of screens written by hand (`custom: {module: '@/screens/steps', export:
// StepListScreen}` of spec/screens/step-list.yaml, the kitchen sink): the list of the steps,
// with the generated card of a step beside it (`/steps/:id`).

import { useNavigate, useParams } from 'react-router';

import { useLanguage } from '@/bazis/i18n';
import { Screen } from '@/bazis/ui/app-shell';
import { ResourceList } from '@/bazis/ui/resource-list';
import { ENTITIES } from '@/screens/generated/entities';
import { routeTo } from '@/screens/generated/screens';

export function StepListScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <Screen id="step-list" title={t('screens.step-list.title')}>
      <ResourceList
        path={ENTITIES.step.path}
        entity="step"
        columns={['title', 'task']}
        selected={id}
        onOpen={(step) => void navigate(routeTo('step-card', step))}
      />
    </Screen>
  );
}
