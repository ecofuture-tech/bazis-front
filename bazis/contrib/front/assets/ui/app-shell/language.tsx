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

// The language of the interface: a button that switches to the next language of the backend
// (`action:language`, its code in `data-value`), next to the color mode; nothing with one
// language. The languages and the change are those of `LanguageProvider` (`@/bazis/i18n`).

import { Languages } from 'lucide-react';

import { useLanguage } from '@/bazis/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A button that switches the language of the interface; nothing with fewer than two languages. */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, languages, setLanguage, t } = useLanguage();
  if (languages.length < 2) return null;
  const index = languages.findIndex((it) => it.code === language);
  const current = languages[index] ?? languages[0];
  const following = languages[(index + 1) % languages.length] ?? languages[0];
  if (current === undefined || following === undefined) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-bz="action:language"
      data-value={language}
      lang={current.code}
      className={cn('gap-1 px-2 text-xs font-semibold uppercase', className)}
      aria-label={t('language.switch', { language: current.name, next: following.name })}
      title={t('language.current', { language: current.name })}
      onClick={() => {
        setLanguage(following.code);
      }}
    >
      <Languages aria-hidden="true" />
      {current.code}
    </Button>
  );
}
