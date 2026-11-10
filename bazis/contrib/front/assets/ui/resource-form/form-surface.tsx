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

// Where a form is shown (`composition.forms` of spec/design/theme.yaml): in a dialog over
// the screen, or as a page in place of the content of its `Screen` (inline outside one),
// with a back button. The form inside keeps its marks (`field:<name>`, `action:submit`),
// so the scenarios find it either way.

import { ArrowLeft } from 'lucide-react';
import { createContext, use, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { THEME } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import { useScreenPage } from '@/bazis/ui/app-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface FormSurfaceProps {
  open: boolean;
  /** Called by the close button of the dialog, Escape, or the back button of the page. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** `composition.forms` of the theme by default. */
  mode?: 'dialog' | 'page';
  /** The form: `ResourceForm`, a form of the screen. */
  children: ReactNode;
}

/** Whether the user changed the form in the surface around it (`ResourceFormBody`), read when it closes. */
const DirtyContext = createContext<RefObject<boolean> | null>(null);

/** Reports to the surface around it whether the user changed the form, once it renders; nothing outside one. */
export function useReportDirty(dirty: boolean): void {
  const changedRef = use(DirtyContext);
  useLayoutEffect(() => {
    if (!changedRef) return;
    changedRef.current = dirty;
    return () => {
      changedRef.current = false;
    };
  }, [changedRef, dirty]);
}

function FormPage({ open, onClose, title, description, children }: Omit<FormSurfaceProps, 'mode'>) {
  const page = useScreenPage();
  const { t } = useLanguage();
  const claim = page?.claim;
  useEffect(() => {
    if (!open || !claim) return;
    claim(true);
    return () => {
      claim(false);
    };
  }, [open, claim]);
  if (!open) return null;
  const content = (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <div className="flex items-start gap-3">
        <Button type="button" variant="ghost" size="icon-sm" className="mt-0.5" aria-label={t('form.back')} onClick={onClose}>
          <ArrowLeft />
        </Button>
        <div className="grid gap-1">
          <h2 className="text-2xl font-subheading">{title}</h2>
          {description !== undefined && <p className="text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="surface p-(--space-card) text-card-foreground">{children}</div>
    </div>
  );
  return page?.target ? createPortal(content, page.target) : content;
}

/** A form in a dialog or as a page, as the theme composes the forms. */
export function FormSurface({ mode = THEME.composition.forms, ...props }: FormSurfaceProps) {
  const { open, onClose, title, description, children } = props;
  const { t } = useLanguage();
  // a form that the user changed is not closed by a click beside it, and asks first when closed;
  // the question goes once the form closes or opens, whatever closed it
  const dirty = useRef(false);
  const [asking, setAsking] = useState(false);
  const [shown, setShown] = useState(open);
  if (shown !== open) {
    setShown(open);
    setAsking(false);
  }
  if (mode === 'page') return <FormPage {...props} />;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (dirty.current) setAsking(true);
        else onClose();
      }}
    >
      {/* the title set apart from the first field a little more than the fields from each other */}
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-8 overflow-y-auto sm:max-w-lg"
        {...(description === undefined ? { 'aria-describedby': undefined } : {})}
        onInteractOutside={(event) => {
          if (dirty.current) event.preventDefault();
        }}
      >
        {/* on a phone too at the start, as its fields */}
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          {description !== undefined && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {asking && (
          <div role="alert" data-bz="state:discard" className="grid gap-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-ink">
            <p>{t('form.discard_question')}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                autoFocus
                onClick={() => {
                  setAsking(false);
                }}
              >
                {t('form.keep')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                data-bz="action:discard"
                onClick={() => {
                  setAsking(false);
                  dirty.current = false;
                  onClose();
                }}
              >
                {t('form.discard')}
              </Button>
            </div>
          </div>
        )}
        <DirtyContext value={dirty}>{children}</DirtyContext>
      </DialogContent>
    </Dialog>
  );
}
