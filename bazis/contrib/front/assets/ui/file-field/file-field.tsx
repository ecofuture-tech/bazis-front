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

// The file field of bazis-uploadable: a drop zone and a picker of a file, uploaded at once
// (`useUpload`, with its progress and a cancel) to the route set of the uploaded files; the
// field is set to the id of the created item, which the form sends as its relationship. A
// file larger than `max_size` of the contract, or of a type that `accept` refuses, is not
// sent. `FileFieldProvider` makes it the control of the file fields of `FieldInput` (the
// forms, the payloads). The input is `data-bz="field:<name>"`, the field
// `data-bz="upload:<name>"` (`aria-busy` while its file uploads, and while its chunk loads:
// `upload-field.tsx`, loaded with the first file field shown); its errors are those of the
// field (`error:<name>`).

import { createContext, lazy, Suspense, use, useMemo, type ReactNode } from 'react';

import { CAPABILITIES } from '@/bazis/generated/contract';
import { FilesProvider, type FileControlProps } from '@/bazis/ui/resource';
import { Skeleton } from '@/components/ui/skeleton';

/** The largest file of an upload of the backend (`BAZIS_FILE_UPLOAD_MAX_SIZE`); null: no limit. */
export const MAX_SIZE: number | null = CAPABILITIES.uploadable?.max_size ?? null;

export interface FileFieldOptions {
  /** The largest file, in bytes; `MAX_SIZE` of the contract by default, null for no limit. */
  maxSize?: number | null;
  /**
   * The types of the files that the picker offers and the field takes, as `accept` of an
   * input (`image/*`, `.pdf,.docx`); any by default: bazis-uploadable takes any file.
   */
  accept?: string | undefined;
  /** The route set of the uploaded files; the route of the resource of the field in `ROUTES` by default. */
  path?: string | undefined;
}

export type FileFieldProps = FileControlProps & FileFieldOptions;

/** Whether a file has a type of `accept` (its MIME types, `type/*`, `.extension`). */
export function accepts(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(',')
    .map((it) => it.trim().toLowerCase())
    .filter(Boolean)
    .some((it) =>
      it.startsWith('.') ? name.endsWith(it) : it.endsWith('/*') ? type.startsWith(it.slice(0, -1)) : type === it,
    );
}

/** The control of a file field, a chunk of its own (`upload-field.tsx`). */
const UploadField = lazy(() => import('./upload-field.js'));

/**
 * The control of a file field: the file of the field (its name downloads it, a thumbnail of an
 * image) with its replace and remove, or a drop zone; the progress of the upload with its
 * cancel. Its chunk is loaded with the first file field shown (`upload:<name>`, `aria-busy`
 * meanwhile, its skeleton `state:loading`).
 */
export function FileField(props: FileFieldProps) {
  return (
    <Suspense
      fallback={
        <div data-bz={`upload:${props.field.name}`} aria-busy="true">
          <Skeleton data-bz="state:loading" className="h-24 w-full rounded-lg" />
        </div>
      }
    >
      <UploadField {...props} />
    </Suspense>
  );
}

interface Options {
  accept: Readonly<Record<string, string>>;
  maxSize: number | null;
}

const NO_TYPES: Readonly<Record<string, string>> = {};

const OptionsContext = createContext<Options>({ accept: NO_TYPES, maxSize: MAX_SIZE });

/** `FileField` with the options of `FileFieldProvider`: one component, so that the fields keep their state. */
function ProvidedFileField(props: FileControlProps) {
  const { accept, maxSize } = use(OptionsContext);
  return <FileField {...props} maxSize={maxSize} accept={accept[props.field.name]} />;
}

/**
 * Makes `FileField` the control of the file fields of `FieldInput` below it (put it in
 * `src/app/providers.tsx`, inside `BazisProvider`). `accept`: the types of a field by its
 * name; `maxSize` and `resources` (the resources of the uploaded files) are those of the
 * contract by default.
 */
export function FileFieldProvider({
  children,
  accept = NO_TYPES,
  maxSize = MAX_SIZE,
  resources,
}: {
  children: ReactNode;
  accept?: Readonly<Record<string, string>>;
  maxSize?: number | null;
  resources?: readonly string[];
}) {
  const options = useMemo(() => ({ accept, maxSize }), [accept, maxSize]);
  return (
    <OptionsContext value={options}>
      <FilesProvider control={ProvidedFileField} {...(resources === undefined ? {} : { resources })}>
        {children}
      </FilesProvider>
    </OptionsContext>
  );
}
