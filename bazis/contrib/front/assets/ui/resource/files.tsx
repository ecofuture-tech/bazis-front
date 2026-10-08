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

// The files of bazis-uploadable: a model references an uploaded file with a to-one
// relationship to a resource of the uploaded files (`resources` of the capability
// `uploadable` of the contract), whose item has the attributes `file` (its URL in the
// storage), `name`, `extension` and `size`. `FileValue` shows one (a link, a thumbnail of an
// image); `FieldInput` edits one with the control that `FilesProvider` gives it (`FileField`
// of the component file-field, which uploads), else with the picker of a relationship.

import { FileText } from 'lucide-react';
import { createContext, use, useMemo, type ComponentProps, type ComponentType, type ReactNode } from 'react';

import { CAPABILITIES } from '@/bazis/generated/contract';
import type { FormField, RelationField } from '@/bazis/react';
import { Skeleton } from '@/components/ui/skeleton';

import { routeOf, type ResourceObject } from './fields.js';
import { useAnyItem } from './hooks.js';

/** The resources of the uploaded files of the contract; none without bazis-uploadable. */
export const FILE_RESOURCES: readonly string[] = CAPABILITIES.uploadable?.resources ?? [];

/** The attributes of the input of a field (`FieldInput`): its id, `data-bz="field:<name>"`, aria. */
export type ControlProps = Pick<ComponentProps<'input'>, 'id' | 'required' | 'aria-invalid' | 'aria-describedby'> & {
  'data-bz': string;
};

/** What `FieldInput` gives the control of a file field. */
export interface FileControlProps {
  /** A to-one relationship to a resource of the uploaded files. */
  field: RelationField;
  /** The id of the uploaded file; null for none. */
  value: string | null;
  onChange: (value: string | null) => void;
  disabled: boolean;
  /** The attributes of the `<input type="file">`. */
  control: ControlProps;
  /** An upload of the field starts or ends: the form is not submitted meanwhile. */
  onBusy: (busy: boolean) => void;
  /** The error of the file (too large, refused by the backend), shown with the errors of the field; null clears it. */
  onError: (message: string | null) => void;
}

interface Files {
  /** The resources of the uploaded files: a to-one relationship to one of them is a file. */
  resources: readonly string[];
  /** The control of a file field in the forms; null: the picker of a relationship. */
  control: ComponentType<FileControlProps> | null;
}

const FilesContext = createContext<Files>({ resources: FILE_RESOURCES, control: null });

/**
 * Gives `FieldInput` the control of the file fields (`FileFieldProvider` of file-field), for
 * the forms and the payloads below it. `resources`: those of the contract by default.
 */
export function FilesProvider({
  control,
  resources = FILE_RESOURCES,
  children,
}: {
  control: ComponentType<FileControlProps> | null;
  resources?: readonly string[];
  children: ReactNode;
}) {
  const value = useMemo(() => ({ control, resources }), [control, resources]);
  return <FilesContext value={value}>{children}</FilesContext>;
}

/** The resources of the uploaded files and the control of a file field. */
export function useFiles(): Files {
  return use(FilesContext);
}

/** Whether a field is a file: a to-one relationship to a resource of the uploaded files. */
export function isFile(field: FormField | undefined, resources: readonly string[]): field is RelationField {
  return field?.kind === 'relation' && !field.many && resources.includes(field.relation);
}

/** The extensions of the files shown as images. */
const IMAGES = ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];

/** Whether a file is an image, by its name or its extension. */
export function isImage(name: string): boolean {
  return IMAGES.includes(name.split('.').pop()?.toLowerCase() ?? '');
}

/** A size in bytes, as `11 B`, `1.2 KB`, `3 MB`. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '')} ${units[unit] ?? ''}`;
}

/** The attributes of an uploaded file. */
export interface UploadedFile {
  /** The URL of the file in the storage (the path of MEDIA_URL for the file system). */
  url: string | null;
  name: string;
  size: number | null;
}

/** The attributes of an item of a resource of the uploaded files. */
export function uploadedFile(item: ResourceObject): UploadedFile {
  const { file, name, size } = item.attributes ?? {};
  const url = typeof file === 'string' && file ? file : null;
  return {
    url,
    name: typeof name === 'string' && name ? name : (url?.split('/').pop() ?? item.id),
    size: typeof size === 'number' ? size : null,
  };
}

/** A file: a thumbnail of an image (`preview`, else its URL) or an icon, its name as a link to it, its size. */
export function FileView({ file, preview }: { file: UploadedFile; preview?: string | null | undefined }) {
  const image = isImage(file.name) ? (preview ?? file.url) : null;
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2 align-middle">
      {image ? (
        <img src={image} alt="" className="size-8 shrink-0 rounded-md border bg-muted object-cover" />
      ) : (
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      {file.url ? (
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="truncate font-medium text-primary underline-offset-4 hover:underline"
          // the link of a row opens the file, not the row
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {file.name}
        </a>
      ) : (
        <span className="truncate">{file.name}</span>
      )}
      {file.size !== null && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatSize(file.size)}</span>
      )}
    </span>
  );
}

/**
 * An uploaded file by its id, read with the retrieve of its route set (a route set of the
 * uploaded files needs no list, which would let a user read the files of the others).
 * `path`: the route set of the resource, instead of its route in `ROUTES`.
 */
export function FileValue({
  relation,
  id,
  path = routeOf(relation),
  preview,
}: {
  relation: string;
  id: string;
  path?: string | undefined;
  /** The URL of a local copy of an image (just uploaded), for its thumbnail. */
  preview?: string | null | undefined;
}) {
  return path ? <StoredFile path={path} id={id} preview={preview} /> : <>{id}</>;
}

function StoredFile({ path, id, preview }: { path: string; id: string; preview: string | null | undefined }) {
  const item = useAnyItem(path, id);
  if (item.data) return <FileView file={uploadedFile(item.data.data)} preview={preview} />;
  if (item.isPending) return <Skeleton className="inline-block h-4 w-28 align-middle" />;
  // the user may not view the file
  return <span className="font-mono text-xs text-muted-foreground">#{id}</span>;
}
