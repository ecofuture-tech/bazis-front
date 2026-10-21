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

// The file fields of bazis-uploadable: a drop zone and a picker of a file (`FileField`) or of
// several (`FilesField`), each uploaded at once (`useUpload`, with its progress and a cancel;
// one at a time) to the route set of the uploaded files; the field is set to the id of the
// created item, or to the ids of the items, which the form sends. A file larger than
// `max_size` of the contract, or of a type that `accept` refuses, is not sent. A file chosen
// here is shown from its local copy (a guest reads no uploaded file back). `FileFieldProvider`
// makes them the controls of the file fields of `FieldInput` (the forms, the payloads, the
// bodies of the actions). The input is `data-bz="field:<name>"`, the field
// `data-bz="upload:<name>"` (`aria-busy` while a file uploads, and while its chunk loads:
// `upload-field.tsx`, loaded with the first file field shown); its errors are those of the
// field (`error:<name>`).

import { createContext, lazy, Suspense, use, useMemo, type ReactNode } from 'react';

import { CAPABILITIES } from '@/bazis/generated/contract';
import { FilesProvider, type FileControlProps, type FilesControlProps } from '@/bazis/ui/resource';
import { Skeleton } from '@/components/ui/skeleton';

/** The largest file of an upload of the backend (`BAZIS_FILE_UPLOAD_MAX_SIZE`); null: no limit. */
export const MAX_SIZE: number | null = CAPABILITIES.uploadable?.max_size ?? null;

/**
 * The types of the files that a guest uploads (`anonymous_types` of the contract, recognized by
 * their content: bazis-uploadable 2.8), as `accept` of an input; undefined when guests upload none.
 */
export const ANONYMOUS_ACCEPT: string | undefined = CAPABILITIES.uploadable?.anonymous_types.join(',') || undefined;

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
export type FilesFieldProps = FilesControlProps & FileFieldOptions;

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

/** The controls of the file fields, a chunk of their own (`upload-field.tsx`). */
const UploadField = lazy(() => import('./upload-field.js'));
const UploadFiles = lazy(() => import('./upload-field.js').then((module) => ({ default: module.UploadFiles })));

function Loading({ name }: { name: string }) {
  return (
    <div data-bz={`upload:${name}`} aria-busy="true">
      <Skeleton data-bz="state:loading" className="h-24 w-full rounded-lg" />
    </div>
  );
}

/**
 * The control of a file field: the file of the field (its name downloads it, a thumbnail of an
 * image) with its replace and remove, or a drop zone; the progress of the upload with its
 * cancel. Its chunk is loaded with the first file field shown (`upload:<name>`, `aria-busy`
 * meanwhile, its skeleton `state:loading`).
 */
export function FileField(props: FileFieldProps) {
  return (
    <Suspense fallback={<Loading name={props.field.name} />}>
      <UploadField {...props} />
    </Suspense>
  );
}

/**
 * The control of a field of several files (the ids of the uploaded files in the body of an
 * action, `list[UploadedFileId]`): the files of the field (`file:<i>`, each with its remove,
 * `action:remove-file-<i>`), those chosen and not uploaded yet with the progress of the one that
 * uploads and its cancel, and a drop zone that takes several files, uploaded one after the
 * other; the value is the ids of the uploaded files in their order. Its chunk is that of
 * `FileField`.
 */
export function FilesField(props: FilesFieldProps) {
  return (
    <Suspense fallback={<Loading name={props.field.name} />}>
      <UploadFiles {...props} />
    </Suspense>
  );
}

interface Options {
  accept: Readonly<Record<string, string>>;
  maxSize: number | null;
  guest: boolean;
}

const NO_TYPES: Readonly<Record<string, string>> = {};

const OptionsContext = createContext<Options>({ accept: NO_TYPES, maxSize: MAX_SIZE, guest: false });

/** The types of a field: those of the guests without a session, else those of `accept`. */
function useAccept(name: string): string | undefined {
  const { accept, guest } = use(OptionsContext);
  return guest ? ANONYMOUS_ACCEPT : accept[name];
}

/** `FileField` with the options of `FileFieldProvider`: one component, so that the fields keep their state. */
function ProvidedFileField(props: FileControlProps) {
  const { maxSize } = use(OptionsContext);
  return <FileField {...props} maxSize={maxSize} accept={useAccept(props.field.name)} />;
}

/** `FilesField` with the options of `FileFieldProvider`. */
function ProvidedFilesField(props: FilesControlProps) {
  const { maxSize } = use(OptionsContext);
  return <FilesField {...props} maxSize={maxSize} accept={useAccept(props.field.name)} />;
}

/**
 * Makes `FileField` and `FilesField` the controls of the file fields of `FieldInput` below it
 * (put it in `src/app/providers.tsx`, inside `BazisProvider`). `accept`: the types of a field
 * by its name; `guest`: the user has no session, so a field takes the types that the guests
 * upload (`ANONYMOUS_ACCEPT`, whatever `accept` says); `maxSize` and `resources` (the resources
 * of the uploaded files) are those of the contract by default.
 */
export function FileFieldProvider({
  children,
  accept = NO_TYPES,
  maxSize = MAX_SIZE,
  guest = false,
  resources,
}: {
  children: ReactNode;
  accept?: Readonly<Record<string, string>>;
  maxSize?: number | null;
  guest?: boolean;
  resources?: readonly string[];
}) {
  const options = useMemo(() => ({ accept, maxSize, guest }), [accept, maxSize, guest]);
  return (
    <OptionsContext value={options}>
      <FilesProvider
        control={ProvidedFileField}
        listControl={ProvidedFilesField}
        {...(resources === undefined ? {} : { resources })}
      >
        {children}
      </FilesProvider>
    </OptionsContext>
  );
}
