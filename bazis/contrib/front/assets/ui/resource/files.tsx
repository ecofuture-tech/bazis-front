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

// The files of bazis-uploadable: a model references an uploaded file with a relationship to a
// resource of the uploaded files (`resources` of the capability `uploadable` of the contract),
// whose item has the attributes `file` (its URL in the storage), `name`, `extension` and
// `size`; the body of an action takes their ids (`UploadedFileId`, `x-relation`). `FileValue`
// shows one (its name downloads it, an image has a thumbnail), both read from the download
// route of its route set with the token: never from the URL of the media host, which serves a
// file to anyone who has its link; `FieldInput` edits a file field with the controls that
// `FilesProvider` gives it (`FileField` and `FilesField` of the component file-field, which
// upload), else with the picker of a relationship.

import { FileLock, FileText } from 'lucide-react';
import { createContext, use, useMemo, type ComponentProps, type ComponentType, type ReactNode } from 'react';

import { ApiError } from '@/bazis/client';
import { CAPABILITIES } from '@/bazis/generated/contract';
import { ENGLISH, formatNumber, useLanguage, type LanguageContextValue } from '@/bazis/i18n';
import type { FormField, RelationField } from '@/bazis/react';
import { Skeleton } from '@/components/ui/skeleton';

import { routeOf, type ResourceObject } from './fields.js';
import { useAnyDownload, useAnyDownloadUrl, useAnyItem } from './hooks.js';

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

/** What `FieldInput` gives the control of a field of several files. */
export interface FilesControlProps extends Omit<FileControlProps, 'value' | 'onChange'> {
  /** A to-many relationship to a resource of the uploaded files (the ids of a body of an action). */
  field: RelationField;
  /** The ids of the uploaded files, in their order. */
  value: readonly string[];
  onChange: (value: string[]) => void;
}

interface Files {
  /** The resources of the uploaded files: a relationship to one of them is a file field. */
  resources: readonly string[];
  /** The control of a field of a file in the forms; null: the picker of a relationship. */
  control: ComponentType<FileControlProps> | null;
  /** The control of a field of several files; null: the picker of the related items. */
  listControl: ComponentType<FilesControlProps> | null;
}

const FilesContext = createContext<Files>({ resources: FILE_RESOURCES, control: null, listControl: null });

/**
 * Gives `FieldInput` the controls of the file fields (`FileFieldProvider` of file-field), for
 * the forms and the payloads below it: `control` of a field of a file, `listControl` of a field
 * of several. `resources`: those of the contract by default.
 */
export function FilesProvider({
  control,
  listControl = null,
  resources = FILE_RESOURCES,
  children,
}: {
  control: ComponentType<FileControlProps> | null;
  listControl?: ComponentType<FilesControlProps> | null;
  resources?: readonly string[];
  children: ReactNode;
}) {
  const value = useMemo(() => ({ control, listControl, resources }), [control, listControl, resources]);
  return <FilesContext value={value}>{children}</FilesContext>;
}

/** The resources of the uploaded files and the controls of the file fields. */
export function useFiles(): Files {
  return use(FilesContext);
}

/**
 * Whether a field is a file field: a relationship to a resource of the uploaded files, of a
 * file or (`many`) of several.
 */
export function isFile(field: FormField | undefined, resources: readonly string[]): field is RelationField {
  return field?.kind === 'relation' && resources.includes(field.relation);
}

/** The extensions of the files shown as images. */
const IMAGES = ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];

/** Whether a file is an image, by its name or its extension. */
export function isImage(name: string): boolean {
  return IMAGES.includes(name.split('.').pop()?.toLowerCase() ?? '');
}

/**
 * A size in bytes in the language of the interface (English by default): `11 B`, `1.2 KB`,
 * `3 MB` (`1,2 КБ` in Russian).
 */
export function formatSize(bytes: number, { language, t }: Pick<LanguageContextValue, 'language' | 't'> = ENGLISH): string {
  if (bytes < 1024) return t('size.bytes', { size: bytes });
  const units = ['size.kb', 'size.mb', 'size.gb', 'size.tb'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const size = formatNumber(value, language, { maximumFractionDigits: value >= 10 ? 0 : 1 });
  return t(units[unit] ?? 'size.tb', { size });
}

/** The attributes of an uploaded file. */
export interface UploadedFile {
  name: string;
  size: number | null;
}

/** The attributes of an item of a resource of the uploaded files. */
function uploadedFile(item: ResourceObject): UploadedFile {
  const { file, name, size } = item.attributes ?? {};
  // the name of the upload, else that of the stored file (the last part of its media URL,
  // which is never linked: the file is downloaded with the token, `useDownload`)
  const stored = typeof file === 'string' && file ? file.split('/').pop() : undefined;
  return {
    name: typeof name === 'string' && name ? name : (stored ?? item.id),
    size: typeof size === 'number' ? size : null,
  };
}

export interface FileViewProps {
  file: UploadedFile;
  /** The URL of the thumbnail of an image (a local copy, or the content read with the token). */
  preview?: string | null | undefined;
  /** Downloads the file: its name is a button; without it, a text. */
  onDownload?: (() => void) | null | undefined;
  /** The download runs. */
  downloading?: boolean | undefined;
  /** The download failed: said next to the name. */
  failed?: boolean | undefined;
}

/** A file: a thumbnail of an image (`preview`) or an icon, its name (a button that downloads it), its size. */
export function FileView({ file, preview, onDownload, downloading = false, failed = false }: FileViewProps) {
  const language = useLanguage();
  const image = isImage(file.name) ? preview : null;
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2 align-middle">
      {image ? (
        <img src={image} alt="" className="size-8 shrink-0 rounded-md border bg-muted object-cover" />
      ) : (
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      {onDownload ? (
        <button
          type="button"
          disabled={downloading}
          aria-busy={downloading || undefined}
          title={file.name}
          className="truncate font-medium text-primary underline-offset-4 hover:underline disabled:opacity-70"
          // the button of a row downloads the file, it does not open the row
          onClick={(event) => {
            event.stopPropagation();
            onDownload();
          }}
        >
          {file.name}
        </button>
      ) : (
        <span title={file.name} className="truncate">
          {file.name}
        </span>
      )}
      {file.size !== null && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatSize(file.size, language)}</span>
      )}
      {failed && (
        <span role="alert" className="shrink-0 text-xs text-destructive">
          {language.t('file.download_failed')}
        </span>
      )}
    </span>
  );
}

/**
 * An uploaded file by its id, read with the retrieve of its route set. bazis-uploadable gives
 * a user only the files he uploaded: the file of another user is `file:unavailable` ("File
 * not available"), as one that cannot be read. `path`: the route set of the resource,
 * instead of its route in `ROUTES`.
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
  const download = useAnyDownload(path);
  const file = item.data ? uploadedFile(item.data.data) : null;
  // the thumbnail of a stored image: its content, read with the token
  const thumbnail = useAnyDownloadUrl(path, file && !preview && isImage(file.name) ? id : null);
  const { t } = useLanguage();
  if (file) {
    return (
      <FileView
        file={file}
        preview={preview ?? thumbnail}
        onDownload={() => {
          download.mutate(id);
        }}
        downloading={download.isPending}
        failed={download.isError}
      />
    );
  }
  if (item.isPending) return <Skeleton className="inline-block h-4 w-28 align-middle" />;
  // bazis-uploadable gives a user only his own files: the file of another user (the
  // attachment of a shared item) is a 404, as a deleted one
  const hidden = item.error instanceof ApiError && (item.error.status === 404 || item.error.status === 403);
  return (
    <span
      data-bz="file:unavailable"
      className="inline-flex items-center gap-1.5 text-muted-foreground"
      title={t(hidden ? 'file.unavailable_hint' : 'file.failed_hint', { id })}
    >
      <FileLock aria-hidden className="size-4 shrink-0" />
      <span>{t(hidden ? 'file.unavailable' : 'file.failed')}</span>
    </span>
  );
}
