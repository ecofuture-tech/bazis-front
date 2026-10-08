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
// `data-bz="upload:<name>"` (`aria-busy` while its file uploads); its errors are those of the
// field (`error:<name>`).

import { RefreshCw, Upload, X } from 'lucide-react';
import { createContext, use, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';

import { ApiError } from '@/bazis/client';
import { CAPABILITIES } from '@/bazis/generated/contract';
import { useUpload, type Upload as UploadState } from '@/bazis/react/uploadable';
import {
  FilesProvider,
  FileValue,
  FileView,
  formatSize,
  isImage,
  routeOf,
  type FileControlProps,
} from '@/bazis/ui/resource';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

/** `useUpload` over a plain path: the field is generic over the route sets of any product. */
const useAnyUpload = useUpload as unknown as (path: string) => UploadState<{ data: { id: string | number } }>;

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

/** The message of a failed upload. */
function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'The upload failed.';
}

/** The file just chosen: its thumbnail while it uploads and once it is the value. */
interface Chosen {
  file: File;
  preview: string | null;
  /** The id of its item, once uploaded. */
  id: string | null;
}

function Progress({ loaded, total }: { loaded: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Upload progress"
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${String(percent)}%` }} />
      </div>
      <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{percent}%</span>
    </div>
  );
}

/**
 * The control of a file field: the file of the field (a link, a thumbnail of an image) with
 * its replace and remove, or a drop zone; the progress of the upload with its cancel.
 */
export function FileField({
  field,
  value,
  onChange,
  disabled,
  control,
  onBusy,
  onError,
  maxSize = MAX_SIZE,
  accept,
  path = routeOf(field.relation),
}: FileFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  // an upload runs: set at once, before the state of the upload renders
  const running = useRef(false);
  const upload = useAnyUpload(path ?? '');
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [dragging, setDragging] = useState(false);
  const uploading = upload.status === 'uploading';
  const removable = field.nullable && !field.required;
  const { abort } = upload;

  // the thumbnail of the file chosen is dropped with it
  useEffect(() => {
    const preview = chosen?.preview;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [chosen?.preview]);
  // a form closed while its file uploads drops the upload
  useEffect(() => abort, [abort]);

  async function take(file: File | undefined) {
    // one file at a time: another file waits until the upload ends or is cancelled
    if (!file || disabled || running.current) return;
    if (maxSize !== null && file.size > maxSize) {
      onError(`The file is larger than ${formatSize(maxSize)}.`);
      return;
    }
    if (!accepts(file, accept)) {
      onError(`The file is not of the type ${accept ?? ''}.`);
      return;
    }
    if (path === undefined) {
      onError(`The files of ${field.relation} have no route in the contract.`);
      return;
    }
    onError(null);
    setChosen({ file, preview: isImage(file.name) ? URL.createObjectURL(file) : null, id: null });
    running.current = true;
    onBusy(true);
    // what this upload changes is for its own file only
    const forget = () => {
      setChosen((current) => (current?.file === file ? null : current));
    };
    try {
      const created = await upload.upload(file);
      if (created === null) {
        // cancelled: the field keeps its file
        forget();
        return;
      }
      const id = String(created.data.id);
      setChosen((current) => (current?.file === file ? { ...current, id } : current));
      onChange(id);
    } catch (error) {
      forget();
      onError(message(error));
    } finally {
      running.current = false;
      onBusy(false);
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void take(event.dataTransfer.files[0]);
  }

  let body: ReactNode;
  if (uploading && chosen) {
    body = (
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <FileView file={{ url: null, name: chosen.file.name, size: chosen.file.size }} preview={chosen.preview} />
          <Button type="button" variant="ghost" size="sm" onClick={abort}>
            <X />
            Cancel
          </Button>
        </div>
        <Progress loaded={upload.progress?.loaded ?? 0} total={upload.progress?.total ?? chosen.file.size} />
      </div>
    );
  } else if (value !== null) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          <FileValue relation={field.relation} id={value} path={path} preview={chosen?.id === value ? chosen.preview : null} />
        </span>
        {!disabled && (
          <span className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => input.current?.click()}>
              <RefreshCw />
              Replace
            </Button>
            {removable && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setChosen(null);
                  onError(null);
                  onChange(null);
                }}
              >
                <X />
                Remove
              </Button>
            )}
          </span>
        )}
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-1.5 py-3 text-center">
        <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm">
          {disabled ? (
            'No file'
          ) : (
            <>
              Drop a file here or{' '}
              <Button type="button" variant="link" className="h-auto p-0" onClick={() => input.current?.click()}>
                choose one
              </Button>
            </>
          )}
        </p>
        {!disabled && (maxSize !== null || accept) && (
          <p className="text-xs text-muted-foreground">
            {[accept, maxSize !== null && `up to ${formatSize(maxSize)}`].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      data-bz={`upload:${field.name}`}
      aria-busy={uploading || undefined}
      onDragOver={(event) => {
        if (disabled || uploading) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={drop}
      className={cn(
        'rounded-md border border-dashed border-input px-3 py-2 transition-colors',
        dragging && 'border-primary bg-primary/5',
        control['aria-invalid'] && 'border-destructive',
        disabled && 'opacity-70',
      )}
    >
      <input
        {...control}
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // the same file chosen again is a change
          event.target.value = '';
          void take(file);
        }}
      />
      {body}
    </div>
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
