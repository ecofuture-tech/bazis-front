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

// The form of a custom action of a route set as a page (`primitive: form` with `form.action`
// of the specs): the properties of its body that it asks for, read from the contract (no
// runtime schema: a guest may read none), sent as its JSON body (`action:submit`); refused,
// the errors of the fields at them and the state of the refusal (`state:invalid` of a 422);
// done, its `result` from the JSON answer of the action (`state:done`), or a toast and
// `onDone`. An action that answers a file (`file` of the contract) saves it first: its result
// is given the name of the file, `{filename}`.

import { LoaderCircle } from 'lucide-react';
import { useState, type ReactNode, type SubmitEvent } from 'react';

import { useLanguage, type Params } from '@/bazis/i18n';
import { customActionAt, useAnyAction, useAnyActionFile } from '@/bazis/ui/resource';
import { errorState, StatePanel, toast } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';

import { ActionFields, bodyDefaults } from './action-fields.js';
import { ActionResult, type ActionThen } from './action-result.js';

export interface ActionFormProps {
  /** The route set of the entity (`ROUTES` of the contract). */
  path: string;
  /** The name of the custom action of the route set in its path, as `custom_actions` of the contract has it. */
  action: string;
  /** The properties of its body that the form asks for, in this order. */
  fields: readonly string[];
  /** The labels of the fields by property, before the titles of the contract. */
  labels?: Readonly<Record<string, string>> | undefined;
  /** The label of the submit button: `Send` by default. */
  submitLabel?: ReactNode;
  /**
   * What the page shows once the action is done, in place of the form: its title (`Done` by
   * default) and its message, the title too when it is a function, given the texts and the
   * numbers of the JSON answer of the action, or `{filename}` of the file it saved.
   */
  result?:
    | {
        title?: ReactNode | ((response: Params) => ReactNode);
        message: (response: Params) => ReactNode;
      }
    | undefined;
  /** The screen that the result links to. */
  then?: ActionThen | undefined;
  /** Called once the action is done, without a `result` (after a toast): the screen after it. */
  onDone?: (() => void) | undefined;
}

/** The texts and the numbers of the JSON answer of an action, the parameters of the message of its result. */
function answerOf(response: unknown): Params {
  if (typeof response !== 'object' || response === null) return {};
  return Object.fromEntries(
    Object.entries(response).filter(
      (entry): entry is [string, string | number] => typeof entry[1] === 'string' || typeof entry[1] === 'number',
    ),
  );
}

/**
 * The form of a custom action of the route set of `path` (`POST <path><action>/`). The
 * contract must have it (the check of the specs, S032).
 */
export function ActionForm({ path, action, fields, labels, submitLabel, result, then, onDone }: ActionFormProps) {
  const { t } = useLanguage();
  const answersJson = useAnyAction(path, action);
  const answersFile = useAnyActionFile(path, action);
  const declared = customActionAt(path, action, false);
  if (declared === undefined) {
    throw new Error(`The contract has no custom action "${action}" of the route ${path}: export the contract again.`);
  }
  const savesFile = declared.file;
  const mutation: typeof answersJson = savesFile ? answersFile : answersJson;
  const body = declared.body ?? {};
  const [values, setValues] = useState(() => bodyDefaults(body, fields));
  // the answer of the action once it is done, while the result is shown
  const [answer, setAnswer] = useState<Params | null>(null);

  if (result && answer !== null) {
    return (
      <ActionResult
        title={(typeof result.title === 'function' ? result.title(answer) : result.title) ?? t('action.done')}
        message={result.message(answer)}
        then={then}
        answer={answer}
        onAgain={() => {
          mutation.reset();
          setValues(bodyDefaults(body, fields));
          setAnswer(null);
        }}
      />
    );
  }

  const failure = mutation.error ? errorState(mutation.error) : null;
  const shown = new Set(fields);
  const fieldErrors = Object.keys(mutation.errors).some((name) => shown.has(name));

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    mutation.mutate(values, {
      onSuccess: (response) => {
        if (result) {
          // the name of the file saved, or the JSON answer
          setAnswer(savesFile ? { filename: response as string } : answerOf(response));
          return;
        }
        toast({ title: t('action.done') });
        onDone?.();
      },
    });
  }

  return (
    <form
      data-bz="state:loaded"
      noValidate
      onSubmit={submit}
      aria-busy={mutation.isPending || undefined}
      className="grid gap-(--space-field)"
    >
      {failure && (
        <StatePanel inline state={failure} error={mutation.error} message={fieldErrors ? t('form.check') : undefined} />
      )}
      <ActionFields
        path={path}
        body={body}
        names={fields}
        labels={labels}
        values={values}
        errors={mutation.errors}
        disabled={mutation.isPending}
        onChange={(name, value) => {
          setValues((current) => ({ ...current, [name]: value }));
        }}
      />
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="submit" data-bz="action:submit" disabled={mutation.isPending}>
          {mutation.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {submitLabel ?? t('form.send')}
        </Button>
      </div>
    </form>
  );
}
