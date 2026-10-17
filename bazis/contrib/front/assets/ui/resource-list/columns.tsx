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

// The view of a list that the user chooses: the columns he hides (every one but the first,
// the name of a row) and the density of the rows of the table. A menu, `action:view`, with a
// checkbox per column, `toggle:<column>`, and the densities, `density:<density>`.

import { Settings2 } from 'lucide-react';

import type { Theme } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** The density of the rows of a table: the spacing of the density of the theme. */
type Density = Theme['density'];

const DENSITIES: readonly Density[] = ['comfortable', 'compact'];

interface ViewMenuProps {
  /** The columns the user may hide. */
  columns: readonly string[];
  title: (name: string) => string;
  hidden: ReadonlySet<string>;
  onHide: (name: string, hidden: boolean) => void;
  /** The density of the rows; no choice of it without (the cards). */
  density: Density | undefined;
  onDensity: (density: Density) => void;
}

/** The menu of the view of a list. */
export function ViewMenu({ columns, title, hidden, onHide, density, onDensity }: ViewMenuProps) {
  const { t } = useLanguage();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" data-bz="action:view">
          <Settings2 />
          {t('list.view')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-bz="menu:view" className="w-56">
        {columns.length > 0 && (
          <>
            <DropdownMenuLabel>{t('list.columns')}</DropdownMenuLabel>
            {columns.map((name) => (
              <DropdownMenuCheckboxItem
                key={name}
                data-bz={`toggle:${name}`}
                checked={!hidden.has(name)}
                // the menu stays open while columns are chosen
                onSelect={(event) => {
                  event.preventDefault();
                }}
                onCheckedChange={(checked) => {
                  onHide(name, !checked);
                }}
              >
                <span className="first-letter:uppercase">{title(name)}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
        {density !== undefined && (
          <>
            {columns.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{t('list.rows')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={density}
              onValueChange={(value) => {
                onDensity(value as Density);
              }}
            >
              {DENSITIES.map((it) => (
                <DropdownMenuRadioItem key={it} value={it} data-bz={`density:${it}`}>
                  {t(`list.density.${it}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
