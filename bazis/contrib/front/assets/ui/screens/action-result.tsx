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

// The result of a custom action that a form ran (`result` of `ActionForm`): `state:done`, its
// title and its message, the link to the screen after it (`nav:<screen>`), the action that
// fills the form again (`action:again`) and the answer of the action (`answer:<property>`, the
// step `remember` of the scenarios).

import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useLanguage, type Params } from '@/bazis/i18n';
import { Button } from '@/components/ui/button';

/** The screen that the result of an action links to. */
export interface ActionThen {
  /** Its id in the specs: the link is `nav:<screen>`. */
  screen: string;
  label: ReactNode;
  /** Its route (`routeTo`). */
  to: string;
}

export interface ActionResultProps {
  title: ReactNode;
  message: ReactNode;
  /** The screen that it links to (`nav:<screen>`). */
  then?: ActionThen | undefined;
  /** Shows the form again, empty (`action:again`). */
  onAgain: () => void;
  /**
   * The texts and the numbers of the answer of the action (`filename` of a file it saved):
   * each a hidden `answer:<property>` with its `data-value`, which the tests read.
   */
  answer?: Params | undefined;
}

/** What a custom action did, in place of its form: `state:done`. */
export function ActionResult({ title, message, then, onAgain, answer }: ActionResultProps) {
  const { t } = useLanguage();
  return (
    <div
      data-bz="state:done"
      role="status"
      className="flex flex-col items-center gap-4 rounded-xl border bg-card px-6 py-12 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success-ink">
        <CircleCheck className="size-5" aria-hidden="true" />
      </span>
      <div className="grid max-w-md gap-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {Object.entries(answer ?? {}).map(([property, value]) => (
        <span key={property} hidden data-bz={`answer:${property}`} data-value={String(value)} />
      ))}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" data-bz="action:again" onClick={onAgain}>
          {t('action.again')}
        </Button>
        {then && (
          <Button asChild>
            <Link to={then.to} data-bz={`nav:${then.screen}`}>
              {then.label}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
