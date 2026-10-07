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
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { THEME } from '@/bazis/generated/theme';
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

function FormPage({ open, onClose, title, description, children }: Omit<FormSurfaceProps, 'mode'>) {
  const page = useScreenPage();
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
        <Button type="button" variant="ghost" size="icon-sm" className="mt-0.5" aria-label="Back" onClick={onClose}>
          <ArrowLeft />
        </Button>
        <div className="grid gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description !== undefined && <p className="text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="rounded-xl border bg-card p-(--space-card) text-card-foreground shadow-xs">{children}</div>
    </div>
  );
  return page?.target ? createPortal(content, page.target) : content;
}

/** A form in a dialog or as a page, as the theme composes the forms. */
export function FormSurface({ mode = THEME.composition.forms, ...props }: FormSurfaceProps) {
  const { open, onClose, title, description, children } = props;
  if (mode === 'page') return <FormPage {...props} />;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" {...(description === undefined ? { 'aria-describedby': undefined } : {})}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description !== undefined && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
