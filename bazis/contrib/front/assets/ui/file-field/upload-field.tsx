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

// The control of `FileField` (file-field.tsx), a chunk of its own: loaded with the first file
// field shown, so that the root of a product (`FileFieldProvider`) does not carry the upload.

import { RefreshCw, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';

import { ApiError } from '@/bazis/client';
import { useLanguage, type Translate } from '@/bazis/i18n';
import { useUpload, type Upload as UploadState } from '@/bazis/react/uploadable';
import { FileValue, FileView, formatSize, isImage, routeOf } from '@/bazis/ui/resource';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { accepts, MAX_SIZE, type FileFieldProps } from './file-field.js';

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
          <FileValue relation={field.relation} id={value} path={path} preview={chosen?.id === value ? chosen.preview : null} />
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
