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

// The input of a decimal (`format: decimal`): a `DecimalField` of the model (the format of the
// contract) or a `Decimal` of Pydantic in the payload of a transit or the body of a custom
// action (a number or a string, `objectFields`). It is typed with the decimal point or the
// decimal comma (`2,5` and `2.5`) and sent as its digits with a point (`'2.5'`), a string,
// which both read exactly.

import { useState } from 'react';

import { useLanguage } from '@/bazis/i18n';
import type { AttributeField } from '@/bazis/react';
import { Input } from '@/components/ui/input';

import type { ControlProps } from './files.js';

/** What can be typed: digits with a point or a comma, after a minus. */
const TYPED = /^-?\d*(?:[.,]\d*)?$/;

/** The decimal separator of a language: `,` in Russian. */
function separator(language: string): string {
  return new Intl.NumberFormat(language).formatToParts(1.5).find((it) => it.type === 'decimal')?.value ?? '.';
}

/** The text of a value in the input, with the decimal separator of the language. */
function textOf(value: unknown, language: string): string {
  const digits = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
  return digits.replace('.', separator(language));
}

/**
 * The input of a decimal: a text whose spaces (the separators of the thousands) are dropped
 * and that takes only digits with a point or a comma; its value is the digits with a point
 * (`'2.5'`), no value (null for a nullable field) without a digit.
 */
export function DecimalInput({
  field,
  value,
  onChange,
  disabled,
  control,
}: {
  field: AttributeField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  control: ControlProps;
}) {
  const { language } = useLanguage();
  // the text typed (`2,` of the value `2,`); a value set from elsewhere (a reset) replaces it
  const [draft, setDraft] = useState(() => ({ value, text: textOf(value, language) }));
  let text = draft.text;
  if (value !== draft.value) {
    text = textOf(value, language);
    setDraft({ value, text });
  }
  return (
    <Input
      {...control}
      type="text"
      inputMode="decimal"
      value={text}
      readOnly={field.readOnly}
      disabled={disabled}
      onChange={(event) => {
        const typed = event.target.value.replace(/\s/g, '');
        if (!TYPED.test(typed)) return;
        const next = /\d/.test(typed) ? typed.replace(',', '.') : field.nullable ? null : undefined;
        setDraft({ value: next, text: typed });
        onChange(next);
      }}
    />
  );
}
