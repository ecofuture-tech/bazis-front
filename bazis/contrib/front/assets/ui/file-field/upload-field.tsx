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

// The controls of `FileField` and `FilesField` (file-field.tsx), a chunk of their own: loaded
// with the first file field shown, so that the root of a product (`FileFieldProvider`) does not
// carry the upload.

import { RefreshCw, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';

import { ApiError } from '@/bazis/client';
import { useLanguage, type Translate } from '@/bazis/i18n';
import { useUpload, type Upload as UploadState } from '@/bazis/react/uploadable';
import { FileValue, FileView, formatSize, isImage, routeOf } from '@/bazis/ui/resource';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { accepts, MAX_SIZE, type FileFieldProps, type FilesFieldProps } from './file-field.js';

/** `useUpload` over a plain path: the field is generic over the route sets of any product. */
const useAnyUpload = useUpload as unknown as (path: string) => UploadState<{ data: { id: string | number } }>;

/** The message of a failed upload: that of the backend, else (the network) `upload.failed`. */
function message(error: unknown, t: Translate): string {
  return error instanceof ApiError ? error.message : t('upload.failed');
}

/** The file just chosen: its thumbnail while it uploads and once it is the value. */
interface Chosen {
  file: File;
  preview: string | null;
  /** The id of its item, once uploaded. */
  id: string | null;
}

function Progress({ loaded, total }: { loaded: number; total: number }) {
  const { t } = useLanguage();
  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t('upload.progress')}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${String(percent)}%` }} />
      </div>
      <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{percent}%</span>
    </div>
  );
}

/** `FileField` once its chunk is loaded. */
export default function UploadField({
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
  const language = useLanguage();
  const { t } = language;
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
      onError(t('upload.too_large', { size: formatSize(maxSize, language) }));
      return;
    }
    if (!accepts(file, accept)) {
      onError(t('upload.wrong_type', { accept: accept ?? '' }));
      return;
    }
    if (path === undefined) {
      onError(t('upload.no_route', { resource: field.relation }));
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
      onError(message(error, t));
    } finally {
      running.current = false;
      onBusy(false);
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    void take(event.dataTransfer.files[0]);
  }

  let body: ReactNode;
  if (uploading && chosen) {
    body = (
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <FileView file={{ name: chosen.file.name, size: chosen.file.size }} preview={chosen.preview} />
          <Button type="button" variant="ghost" size="sm" onClick={abort}>
            <X />
            {t('action.cancel')}
          </Button>
        </div>
        <Progress loaded={upload.progress?.loaded ?? 0} total={upload.progress?.total ?? chosen.file.size} />
      </div>
    );
  } else if (value !== null) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          {/* the file chosen here from its local copy: a guest reads no uploaded file back */}
          {chosen?.id === value ? (
            <FileView file={{ name: chosen.file.name, size: chosen.file.size }} preview={chosen.preview} />
          ) : (
            <FileValue relation={field.relation} id={value} path={path} />
          )}
        </span>
        {!disabled && (
          <span className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => input.current?.click()}>
              <RefreshCw />
              {t('upload.replace')}
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
                {t('upload.remove')}
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
            t('upload.none')
          ) : (
            <>
              {t('upload.drop')}{' '}
              <Button type="button" variant="link" className="h-auto p-0" onClick={() => input.current?.click()}>
                {t('upload.choose')}
              </Button>
            </>
          )}
        </p>
        {!disabled && (maxSize !== null || accept) && (
          <p className="text-xs text-muted-foreground">
            {[accept, maxSize !== null && t('upload.up_to', { size: formatSize(maxSize, language) })].filter(Boolean).join(', ')}
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
        // always take the drag over the field: a file left to the browser opens in the tab
        event.preventDefault();
        if (disabled || uploading) {
          event.dataTransfer.dropEffect = 'none';
          return;
        }
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

/** A file of `FilesField` chosen here: waiting for its upload, or uploaded (the id of its item). */
interface Listed extends Chosen {
  key: number;
}

/** `FilesField` once its chunk is loaded. */
export function UploadFiles({
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
}: FilesFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useAnyUpload(path ?? '');
  const [chosen, setChosen] = useState<readonly Listed[]>([]);
  const [dragging, setDragging] = useState(false);
  const language = useLanguage();
  const { t } = language;
  // the files that wait for their upload, in their order, and whether the uploads run
  const queue = useRef<Listed[]>([]);
  const running = useRef(false);
  const keys = useRef(0);
  // the value as it is now, for an upload that ends after it changed
  const current = useRef(value);
  // the field is shown: an upload that ends once it is not starts no other
  const shown = useRef(true);
  // the local copies of the images, dropped with their files and with the field
  const previews = useRef(new Set<string>());
  const { abort } = upload;

  useEffect(() => {
    current.current = value;
  }, [value]);
  useEffect(() => {
    const urls = previews.current;
    shown.current = true;
    return () => {
      shown.current = false;
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);
  // a form closed while a file uploads drops the upload
  useEffect(() => abort, [abort]);

  function drop(item: Listed) {
    setChosen((list) => list.filter((it) => it.key !== item.key));
    if (item.preview && previews.current.delete(item.preview)) URL.revokeObjectURL(item.preview);
  }

  async function run() {
    if (running.current) return;
    running.current = true;
    onBusy(true);
    try {
      for (let item = queue.current.shift(); item && shown.current; item = queue.current.shift()) {
        const taken = item;
        try {
          const created = await upload.upload(taken.file);
          if (created === null) {
            // cancelled: the file is left out
            drop(taken);
            continue;
          }
          const id = String(created.data.id);
          setChosen((list) => list.map((it) => (it.key === taken.key ? { ...it, id } : it)));
          current.current = [...current.current, id];
          onChange([...current.current]);
        } catch (error) {
          drop(taken);
          onError(message(error, t));
        }
      }
    } finally {
      running.current = false;
      onBusy(false);
    }
  }

  function take(files: readonly File[]) {
    if (disabled || !files.length) return;
    let refused: string | null = null;
    const accepted = files.filter((file) => {
      if (maxSize !== null && file.size > maxSize) {
        refused ??= t('upload.too_large', { size: formatSize(maxSize, language) });
        return false;
      }
      if (!accepts(file, accept)) {
        refused ??= t('upload.wrong_type', { accept: accept ?? '' });
        return false;
      }
      return true;
    });
    onError(refused);
    if (!accepted.length) return;
    if (path === undefined) {
      onError(t('upload.no_route', { resource: field.relation }));
      return;
    }
    const taken = accepted.map((file): Listed => {
      const preview = isImage(file.name) ? URL.createObjectURL(file) : null;
      if (preview) previews.current.add(preview);
      keys.current += 1;
      return { key: keys.current, file, preview, id: null };
    });
    queue.current.push(...taken);
    setChosen((list) => [...list, ...taken]);
    void run();
  }

  function remove(id: string) {
    const item = chosen.find((it) => it.id === id);
    if (item) drop(item);
    current.current = current.current.filter((it) => it !== id);
    onChange([...current.current]);
  }

  function cancel(item: Listed) {
    const waiting = queue.current.findIndex((it) => it.key === item.key);
    if (waiting === -1) {
      // the one that uploads
      abort();
      return;
    }
    queue.current.splice(waiting, 1);
    drop(item);
  }

  const uploaded = new Map(chosen.flatMap((it) => (it.id === null ? [] : [[it.id, it] as const])));
  const waiting = chosen.filter((it) => it.id === null);
  // the files of the value, then those that wait for their upload (the first one uploads)
  const files: { key: string; item: Listed | undefined; id: string | null }[] = [
    ...value.map((id) => ({ key: `id:${id}`, item: uploaded.get(id), id })),
    ...waiting.map((it) => ({ key: `new:${String(it.key)}`, item: it, id: null })),
  ];
  const busy = waiting.length > 0;

  return (
    <div
      data-bz={`upload:${field.name}`}
      aria-busy={busy || undefined}
      onDragOver={(event) => {
        // always take the drag over the field: a file left to the browser opens in the tab
        event.preventDefault();
        if (disabled) {
          event.dataTransfer.dropEffect = 'none';
          return;
        }
        setDragging(true);
      }}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        take(Array.from(event.dataTransfer.files));
      }}
      className={cn(
        'grid gap-2 rounded-md border border-dashed border-input px-3 py-2 transition-colors',
        dragging && 'border-primary bg-primary/5',
        control['aria-invalid'] && 'border-destructive',
        disabled && 'opacity-70',
      )}
    >
      <input
        {...control}
        ref={input}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const chosenFiles = Array.from(event.target.files ?? []);
          // the same files chosen again are a change
          event.target.value = '';
          take(chosenFiles);
        }}
      />
      {files.length > 0 && (
        <ul className="grid gap-1.5">
          {files.map(({ key, item, id }, index) => (
            <li key={key} data-bz={`file:${String(index)}`} className="grid gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  {item ? (
                    <FileView file={{ name: item.file.name, size: item.file.size }} preview={item.preview} />
                  ) : (
                    <FileValue relation={field.relation} id={id ?? ''} path={path} />
                  )}
                </span>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    data-bz={`action:remove-file-${String(index)}`}
                    aria-label={t(id === null ? 'action.cancel' : 'upload.remove')}
                    title={t(id === null ? 'action.cancel' : 'upload.remove')}
                    onClick={() => {
                      if (id !== null) remove(id);
                      else if (item) cancel(item);
                    }}
                  >
                    <X />
                  </Button>
                )}
              </div>
              {item !== undefined && item === waiting[0] && upload.status === 'uploading' && (
                <Progress loaded={upload.progress?.loaded ?? 0} total={upload.progress?.total ?? item.file.size} />
              )}
            </li>
          ))}
        </ul>
      )}
      {disabled ? (
        !files.length && <p className="py-1 text-sm">{t('upload.none')}</p>
      ) : (
        <div className="flex flex-col items-center gap-1 py-2 text-center">
          <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm">
            {t('upload.drop_files')}{' '}
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => input.current?.click()}>
              {t('upload.choose_files')}
            </Button>
          </p>
          {(maxSize !== null || accept) && (
            <p className="text-xs text-muted-foreground">
              {[accept, maxSize !== null && t('upload.up_to', { size: formatSize(maxSize, language) })].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
